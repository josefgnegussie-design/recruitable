import { after, NextResponse } from "next/server";
import { kravBolagsadmin } from "@/lib/bolagsadmin";
import { rateLimit } from "@/lib/rateLimit";
import {
  arOppen,
  kravMedSvar,
  MAX_ORD_I_PRESENTATION,
  raknaOrdIText,
  rensadTackning,
} from "@/lib/upphandling";
import { hamtaBolagForUpphandling, UUID_RE } from "@/lib/upphandlingRepo";
import { sendUpphandlingNyAnmalan } from "@/lib/emailUpphandling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KOLUMNER = "id, title, cities, competences, requirements, moderation_status, closed_at, interest_deadline, requester_email";

function kortText(v, max) {
  return v === undefined || v === null || (typeof v === "string" && v.length <= max);
}

async function hamtaOppen(admin, id) {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { fel: "Ogiltig förfrågan.", status: 400 };
  const { data: u } = await admin.from("procurements").select(KOLUMNER).eq("id", id).maybeSingle();
  if (!u || u.moderation_status !== "approved") return { fel: "Hittades inte.", status: 404 };
  if (!arOppen(u)) return { fel: "Sista dag att anmäla intresse har passerat.", status: 409 };
  return { u };
}

// Bolaget anmäler eller ändrar sitt intresse. En anmälan kan ändras fram till
// sista dagen, men köparen får bara mejl första gången.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-intresse", 30, 3600);
  if (limited) return limited;

  const { fel: authFel, admin, rad, user } = await kravBolagsadmin();
  if (authFel) return authFel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { fel, status, u } = await hamtaOppen(admin, body.upphandlingId);
  if (fel) return NextResponse.json({ error: fel }, { status });

  const tackning = rensadTackning(body.tackning, u.cities, u.competences);
  if (!tackning?.length) {
    return NextResponse.json({ error: "Markera minst en ort och kompetens ni kan leverera." }, { status: 400 });
  }

  if (!kortText(body.kapacitet, 120) || !kortText(body.referens, 200)) {
    return NextResponse.json({ error: "Kapacitet eller referens är för lång." }, { status: 400 });
  }
  if (!kortText(body.meddelande, 1500) || raknaOrdIText(body.meddelande) > MAX_ORD_I_PRESENTATION) {
    return NextResponse.json({ error: `Presentationen får vara högst ${MAX_ORD_I_PRESENTATION} ord.` }, { status: 400 });
  }

  // Svaren räknas om här: det som står i profilen är facit, inte vad
  // webbläsaren skickade.
  const bolag = await hamtaBolagForUpphandling(admin, rad.company_id);
  const krav = kravMedSvar(u.requirements, bolag || {}, body.svar || {});
  if (krav.some((k) => k.niva === "ska" && !k.uppfylls)) {
    return NextResponse.json({ error: "Alla ska-krav måste vara uppfyllda." }, { status: 400 });
  }

  const { data: fanns } = await admin
    .from("procurement_interests")
    .select("id")
    .eq("procurement_id", u.id)
    .eq("company_id", rad.company_id)
    .maybeSingle();

  const { error } = await admin.from("procurement_interests").upsert(
    {
      procurement_id: u.id,
      company_id: rad.company_id,
      coverage: tackning,
      requirement_answers: Object.fromEntries(krav.map((k) => [k.id, { uppfylls: k.uppfylls, kalla: k.kalla }])),
      capacity: body.kapacitet?.trim() || null,
      reference: body.referens?.trim() || null,
      message: body.meddelande?.trim() || null,
      open_to_partner: body.samarbete === true,
      contact_email: user.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "procurement_id,company_id" }
  );

  if (error) {
    console.error("Kunde inte spara intresseanmälan:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara anmälan. Försök igen." }, { status: 500 });
  }

  if (!fanns) {
    after(() =>
      sendUpphandlingNyAnmalan({
        till: u.requester_email,
        titel: u.title,
        bolag: bolag?.name || "Ett bolag",
        antalKombinationer: tackning.length,
      })
    );
  }

  return NextResponse.json({ ok: true, ny: !fanns });
}

// Bolaget drar tillbaka sin anmälan, så länge upphandlingen är öppen.
export async function DELETE(request) {
  const limited = await rateLimit(request, "upphandling-intresse", 30, 3600);
  if (limited) return limited;

  const { fel: authFel, admin, rad } = await kravBolagsadmin();
  if (authFel) return authFel;

  const id = new URL(request.url).searchParams.get("upphandling");
  const { fel, status, u } = await hamtaOppen(admin, id);
  if (fel) return NextResponse.json({ error: fel }, { status });

  const { error } = await admin
    .from("procurement_interests")
    .delete()
    .eq("procurement_id", u.id)
    .eq("company_id", rad.company_id);

  if (error) {
    console.error("Kunde inte ta bort intresseanmälan:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte ta bort anmälan." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
