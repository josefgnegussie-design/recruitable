import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { sendKontoGodkantTillBolag } from "@/lib/email";

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

  if (typeof ansokanId !== "string" || !["godkann", "avsla"].includes(beslut)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

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
    return NextResponse.json({ ok: true, beslut: "avslagen" });
  }

  let bolagId = Number.isInteger(companyId) ? companyId : null;

  if (bolagId) {
    const { data: finns } = await admin.from("companies").select("id").eq("id", bolagId).maybeSingle();
    if (!finns) {
      return NextResponse.json({ error: "Det valda bolaget finns inte." }, { status: 400 });
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

    const { error: skapaFel } = await admin.from("companies").insert({
      id: bolagId,
      name: ansokan.claimed_company_name,
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

  const { error: kopplaFel } = await admin
    .from("company_admins")
    .update({ company_id: bolagId, verified: true })
    .eq("id", ansokanId);

  if (kopplaFel) {
    console.error("Kunde inte koppla ansökan till bolag:", JSON.stringify(kopplaFel));
    return NextResponse.json({ error: "Kunde inte godkänna. Försök igen." }, { status: 500 });
  }

  // Profilen är nu bolagets egen — inbjudan att ta över den ska bort.
  await admin.from("companies").update({ claimed: true }).eq("id", bolagId);

  // Beskedet som registreringen lovar. Misslyckas det ska godkännandet ändå
  // stå fast; kontot fungerar oavsett om mejlet kom fram.
  const { data: konto } = await admin.auth.admin.getUserById(ansokan.user_id);
  if (konto?.user?.email) {
    await sendKontoGodkantTillBolag({
      to: konto.user.email,
      companyName: ansokan.claimed_company_name,
      companyId: bolagId,
    }).catch((err) => console.error("Kunde inte skicka godkännandebesked:", err.message));
  }

  return NextResponse.json({ ok: true, beslut: "godkänd", companyId: bolagId });
}
