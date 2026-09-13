import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { hamtaSammanslagningsbolag, utforSammanslagning } from "@/lib/sammanslagning";
import { sendSammanslagningBeslut } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Adresserna som ska få beskedet: den som begärde sammanslagningen, plus varje
// verifierad administratör på båda bolagen. Den upphörande sidans administratörer
// flyttas till det överlevande bolaget vid ett godkännande — de ska inte upptäcka
// det genom att deras profil bytt namn nästa gång de loggar in.
async function mottagare(admin, { requestedBy, companyId, survivorId }) {
  const { data: rader } = await admin
    .from("company_admins")
    .select("user_id")
    .in("company_id", [companyId, survivorId])
    .eq("verified", true);

  const idn = [...new Set([requestedBy, ...(rader ?? []).map((r) => r.user_id)])];

  const adresser = await Promise.all(
    idn.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return data?.user?.email ?? null;
    })
  );

  return [...new Set(adresser.filter(Boolean))];
}

// Godkänner eller nekar en begäran om sammanslagning.
//
// Ett godkännande gör bolaget osynligt i sökningen, flyttar dess orter, kontor
// och administratörer till det överlevande bolaget, och låter slugen svara med en
// permanent vidarebefordran. Raden raderas aldrig — se resonemanget i
// supabase/migration_sammanslagning.sql.
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

  const { arendeId, beslut, not } = body;

  if (
    typeof arendeId !== "string" ||
    !arendeId ||
    !["godkann", "avsla"].includes(beslut) ||
    (not !== undefined && not !== null && (typeof not !== "string" || not.length > 2000))
  ) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: arende } = await admin
    .from("merge_requests")
    .select("id, company_id, survivor_id, requested_by, reason, status")
    .eq("id", arendeId)
    .maybeSingle();

  if (!arende) {
    return NextResponse.json({ error: "Ärendet hittades inte." }, { status: 404 });
  }

  if (arende.status !== "pending") {
    return NextResponse.json({ error: "Ärendet är redan avgjort." }, { status: 409 });
  }

  const beslutsfalt = {
    decided_at: new Date().toISOString(),
    decided_by: user.id,
    decision_note: not?.trim() || null,
  };

  // Adresserna hämtas före verkställandet: administratörerna flyttas, och efteråt
  // går det inte längre att se vilka som hörde till det upphörande bolaget.
  const till = await mottagare(admin, {
    requestedBy: arende.requested_by,
    companyId: arende.company_id,
    survivorId: arende.survivor_id,
  });

  const bolagInnan = await hamtaSammanslagningsbolag(admin, [arende.company_id, arende.survivor_id]);
  const namnUpphorande = bolagInnan[arende.company_id]?.name ?? `Bolag ${arende.company_id}`;
  const namnOverlevande = bolagInnan[arende.survivor_id]?.name ?? `Bolag ${arende.survivor_id}`;
  const slugOverlevande = bolagInnan[arende.survivor_id]?.slug ?? arende.survivor_id;

  if (beslut === "avsla") {
    const { error } = await admin
      .from("merge_requests")
      .update({ status: "rejected", ...beslutsfalt })
      .eq("id", arendeId);

    if (error) {
      console.error("Kunde inte neka ärendet:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte neka. Försök igen." }, { status: 500 });
    }

    await Promise.allSettled(
      till.map((to) =>
        sendSammanslagningBeslut({
          to,
          upphorande: namnUpphorande,
          overlevande: namnOverlevande,
          godkant: false,
          not: beslutsfalt.decision_note,
        })
      )
    );

    return NextResponse.json({ ok: true, beslut: "nekad" });
  }

  const { fel, resultat } = await utforSammanslagning(admin, {
    companyId: arende.company_id,
    survivorId: arende.survivor_id,
    reason: arende.reason,
  });

  // Hindren kan ha tillkommit efter att begäran skickades — bolaget kan ha köpt
  // premium under tiden. Ärendet lämnas öppet, så det går att ta om när hindret
  // är undanröjt.
  if (fel) return NextResponse.json({ error: fel }, { status: 409 });

  const { error: statusFel } = await admin
    .from("merge_requests")
    .update({ status: "approved", ...beslutsfalt })
    .eq("id", arendeId);

  // Sammanslagningen är redan gjord och registret är rätt. Att svara med ett fel
  // här hade fått det att se ut som om ingenting hänt, och nästa försök stoppas
  // ändå av att bolaget redan är sammanslaget.
  if (statusFel) {
    console.error("Sammanslagningen gjord men ärendet kunde inte stängas:", JSON.stringify(statusFel));
    resultat.anmarkningar.push(
      "Ärendet ligger kvar som öppet i kön trots att sammanslagningen är gjord — stäng det för hand."
    );
  }

  await Promise.allSettled(
    till.map((to) =>
      sendSammanslagningBeslut({
        to,
        upphorande: namnUpphorande,
        overlevande: namnOverlevande,
        godkant: true,
        not: beslutsfalt.decision_note,
        profilSlug: slugOverlevande,
      })
    )
  );

  return NextResponse.json({
    ok: true,
    beslut: "godkänd",
    arvdaOrter: resultat.arvdaOrter,
    flyttadeKontor: resultat.flyttadeKontor,
    flyttadeAdmins: resultat.flyttadeAdmins,
    anmarkningar: resultat.anmarkningar,
  });
}
