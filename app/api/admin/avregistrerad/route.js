import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { taUrRegistret, utforSammanslagning } from "@/lib/sammanslagning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATGARDER = ["ta-ur", "sla-ihop", "behall"];

// Granskarens beslut om ett bolag som Bolagsverket säger är avregistrerat.
//
// Registerkontrollen (/api/cron/bolagsverket-koll) skriver bara ner uppgiften —
// den döljer aldrig något själv. Skälet är att avregistreringen inte säger vad
// som ska hända med kortet: gick verksamheten över till ett annat bolag ska
// profilen peka dit, upphörde den ska profilen ligga kvar och säga det, och är
// organisationsnumret i vårt register fel ska bolaget stå kvar som det är.
// Den skillnaden går inte att läsa ur registret.
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

  const { companyId, atgard, survivorId } = body;

  if (!Number.isInteger(companyId) || !ATGARDER.includes(atgard)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (atgard === "behall") {
    // Bolaget står kvar i registret. Uppgiften om avregistreringen ligger kvar
    // som den är — den är sann — men ärendet lämnar kön.
    const { error } = await admin
      .from("companies")
      .update({ deregistration_handled_at: new Date().toISOString() })
      .eq("id", companyId);

    if (error) {
      console.error("Kunde inte lägga undan ärendet:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte spara. Försök igen." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, atgard: "behållet" });
  }

  if (atgard === "sla-ihop") {
    if (!Number.isInteger(survivorId)) {
      return NextResponse.json({ error: "Välj vilket bolag som lever vidare." }, { status: 400 });
    }

    const { fel, resultat } = await utforSammanslagning(admin, {
      companyId,
      survivorId,
      reason: "avregistrerad",
    });

    if (fel) return NextResponse.json({ error: fel }, { status: 409 });

    return NextResponse.json({
      ok: true,
      atgard: "sammanslaget",
      arvdaOrter: resultat.arvdaOrter,
      flyttadeKontor: resultat.flyttadeKontor,
      flyttadeAdmins: resultat.flyttadeAdmins,
      anmarkningar: resultat.anmarkningar,
    });
  }

  const { fel } = await taUrRegistret(admin, { companyId, reason: "avregistrerad" });
  if (fel) return NextResponse.json({ error: fel }, { status: 409 });

  return NextResponse.json({ ok: true, atgard: "ur registret" });
}
