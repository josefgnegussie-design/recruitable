import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { unikSlug } from "@/lib/slug";
import { stamplaBolagsadmin } from "@/lib/bolagsadmin";
import { sendKontoAvslagetTillBolag, sendKontoGodkantTillBolag } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Godkänner eller avslår en kontoansökan.
//
// Ett godkännande gör tre saker: kopplar ansökan till rätt bolag i registret,
// markerar administratören som verifierad, och sätter bolaget som övertaget så
// att inbjudan att ta över profilen försvinner.
//
// Finns bolaget inte i registret skapas det ur ansökans uppgifter. Det är
// meningen — registret ska kunna växa med bolag som söker sig hit själva, utan
// att någon behöver lägga in dem för hand först.
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { ansokanId, beslut, companyId } = body;
  const anledning = typeof body.anledning === "string" ? body.anledning.trim().slice(0, 500) : "";

  if (typeof ansokanId !== "string" || !["godkann", "avsla", "aterkalla"].includes(beslut)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  async function epostFor(userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  }

  // Ångrar ett automatiskt övertagande. Alla administratörer för bolaget tas
  // bort, inte bara ägaren: den som tagit över fel bolag kan ha bjudit in andra.
  if (beslut === "aterkalla") {
    const { data: rad } = await admin
      .from("company_admins")
      .select("company_id, user_id, godkand_av, companies(name)")
      .eq("id", ansokanId)
      .maybeSingle();

    if (!rad?.company_id || rad.godkand_av !== "automatiskt") {
      return NextResponse.json({ error: "Övertagandet hittades inte." }, { status: 404 });
    }

    const { data: borttagna, error } = await admin
      .from("company_admins")
      .delete()
      .eq("company_id", rad.company_id)
      .select("user_id");

    if (error) {
      console.error("Kunde inte återkalla övertagande:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte återkalla. Försök igen." }, { status: 500 });
    }

    await admin.from("companies").update({ claimed: false }).eq("id", rad.company_id);
    await Promise.all(
      (borttagna ?? []).map(async (b) => {
        await admin.auth.admin
          .updateUserById(b.user_id, { user_metadata: { bolagsadmin: false } })
          .catch((err) => console.error("Kunde inte ta bort stämpeln:", err.message));
        const to = await epostFor(b.user_id);
        if (to) {
          await sendKontoAvslagetTillBolag({
            to,
            companyName: rad.companies?.name || "bolaget",
            anledning,
            aterkallad: true,
          }).catch((err) => console.error("Kunde inte skicka besked om återkallelse:", err.message));
        }
      })
    );

    return NextResponse.json({ ok: true, beslut: "återkallad" });
  }

  const { data: ansokan, error: hamtFel } = await admin
    .from("company_admins")
    .select("id, user_id, verified, company_id, claimed_company_name, claimed_org_number, claimed_address, claimed_website, claimed_focus_areas, claimed_services")
    .eq("id", ansokanId)
    .maybeSingle();

  if (hamtFel || !ansokan) {
    return NextResponse.json({ error: "Ansökan hittades inte." }, { status: 404 });
  }

  if (ansokan.verified) {
    return NextResponse.json({ error: "Ansökan är redan godkänd." }, { status: 400 });
  }

  if (beslut === "avsla") {
    const { error } = await admin.from("company_admins").delete().eq("id", ansokanId);
    if (error) {
      console.error("Kunde inte avslå ansökan:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte avslå. Försök igen." }, { status: 500 });
    }

    const to = await epostFor(ansokan.user_id);
    if (to) {
      await sendKontoAvslagetTillBolag({ to, companyName: ansokan.claimed_company_name, anledning }).catch((err) =>
        console.error("Kunde inte skicka avslagsbesked:", err.message)
      );
    }

    return NextResponse.json({ ok: true, beslut: "avslagen" });
  }

  let bolagId = Number.isInteger(companyId) ? companyId : null;

  if (bolagId) {
    const { data: finns } = await admin
      .from("companies")
      .select("id, org_number")
      .eq("id", bolagId)
      .maybeSingle();
    if (!finns) {
      return NextResponse.json({ error: "Det valda bolaget finns inte." }, { status: 400 });
    }

    // De importerade bolagen saknar ofta organisationsnummer, och då hittar
    // matchningen i granskningskön ingenting nästa gång någon söker samma
    // bolag. Numret kommer från bolaget självt i ansökan, så det fylls i här.
    // Ett befintligt nummer skrivs aldrig över — skiljer de sig åt är det
    // något att titta på, inte något att tysta.
    if (!finns.org_number && ansokan.claimed_org_number) {
      await admin
        .from("companies")
        .update({ org_number: ansokan.claimed_org_number })
        .eq("id", bolagId);
    }
  } else {
    // Nytt bolag ur ansökan. Id sätts explicit eftersom kolumnen saknar
    // sekvens — registret importerades med bestämda nummer.
    const { data: hogsta } = await admin
      .from("companies")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    bolagId = (hogsta?.id ?? 0) + 1;

    // Slugen sätts direkt. Utan den vore det nya bolaget det enda i registret
    // utan adressvänligt namn tills backfyllningen körts nästa gång.
    const { data: tagna } = await admin.from("companies").select("slug").not("slug", "is", null);
    const slug = unikSlug(
      ansokan.claimed_company_name,
      new Set((tagna ?? []).map((b) => b.slug)),
      bolagId
    );

    const { error: skapaFel } = await admin.from("companies").insert({
      id: bolagId,
      name: ansokan.claimed_company_name,
      slug,
      org_number: ansokan.claimed_org_number,
      city: (ansokan.claimed_address || "").split(",").pop()?.trim().replace(/^\d{3}\s?\d{2}\s*/, "") || "Okänd",
      address: ansokan.claimed_address,
      link: ansokan.claimed_website,
      focus: ansokan.claimed_focus_areas ?? [],
      services: ansokan.claimed_services ?? [],
      claimed: true,
    });

    if (skapaFel) {
      console.error("Kunde inte skapa bolag ur ansökan:", JSON.stringify(skapaFel));
      return NextResponse.json({ error: "Kunde inte skapa bolaget. Försök igen." }, { status: 500 });
    }
  }

  // Första godkända administratören för ett bolag blir ägare och svarar därmed
  // för prenumerationen. Finns redan en ägare — bolaget har godkänts förut —
  // läggs den nya till som vanlig administratör.
  const { data: agare } = await admin
    .from("company_admins")
    .select("id")
    .eq("company_id", bolagId)
    .eq("ar_agare", true)
    .maybeSingle();

  const { error: kopplaFel } = await admin
    .from("company_admins")
    .update({
      company_id: bolagId,
      verified: true,
      ar_agare: !agare,
      godkand_at: new Date().toISOString(),
      godkand_av: user.email,
    })
    .eq("id", ansokanId);

  if (kopplaFel) {
    console.error("Kunde inte koppla ansökan till bolag:", JSON.stringify(kopplaFel));
    return NextResponse.json({ error: "Kunde inte godkänna. Försök igen." }, { status: 500 });
  }

  // Profilen är nu bolagets egen — inbjudan att ta över den ska bort.
  const { data: bolaget } = await admin
    .from("companies")
    .update({ claimed: true })
    .eq("id", bolagId)
    .select("slug")
    .maybeSingle();

  await stamplaBolagsadmin(admin, ansokan.user_id);

  // Beskedet som registreringen lovar. Misslyckas det ska godkännandet ändå
  // stå fast; kontot fungerar oavsett om mejlet kom fram.
  const { data: konto } = await admin.auth.admin.getUserById(ansokan.user_id);
  if (konto?.user?.email) {
    await sendKontoGodkantTillBolag({
      to: konto.user.email,
      companyName: ansokan.claimed_company_name,
      companyId: bolagId,
      slug: bolaget?.slug,
    }).catch((err) => console.error("Kunde inte skicka godkännandebesked:", err.message));
  }

  return NextResponse.json({ ok: true, beslut: "godkänd", companyId: bolagId });
}
