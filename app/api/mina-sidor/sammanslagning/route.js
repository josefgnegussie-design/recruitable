import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kravBolagsadmin } from "@/lib/bolagsadmin";
import {
  giltigtSkal,
  hamtaArenden,
  hamtaSammanslagningsbolag,
  hinderFor,
} from "@/lib/sammanslagning";
import { sendSammanslagningTillAdmins } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

// Bolagets begäran om att två kort ska bli ett.
//
// Ingenting verkställs här. Behörigheten går inte att avgöra maskinellt:
// Bolagsverkets värdefulla datamängder ger inte ägarstruktur, så vi kan inte
// kontrollera att Jovi Konsult AB äger Jovi Konsult Syd AB. Det som går att
// kontrollera är att den som begär det är verifierad ägare av ett av de två
// bolagen — mejldomänen matchades mot webbplatsen redan vid registreringen.
// Resten är en människas bedömning i /admin/sammanslagningar.
//
// Utan den spärren vore det här en knapp för att radera en konkurrent.
export async function POST(request) {
  const limited = await rateLimit(request, "mina-sidor-sammanslagning", 10, 3600);
  if (limited) return limited;

  // Ägaren och ingen annan: en sammanslagning avgör vilket av två bolag som
  // finns kvar i registret, och den frågan hör till samma nivå som
  // prenumerationen och administratörerna.
  const { fel, admin, rad, user } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { motpartId, viUpphor, skal, datum, meddelande } = body;

  if (
    !Number.isInteger(motpartId) ||
    typeof viUpphor !== "boolean" ||
    !giltigtSkal(skal) ||
    (datum !== undefined && datum !== null && datum !== "" && !DATUM_RE.test(String(datum))) ||
    (meddelande !== undefined &&
      meddelande !== null &&
      (typeof meddelande !== "string" || meddelande.length > 2000))
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  if (motpartId === rad.company_id) {
    return NextResponse.json({ error: "Ett bolag kan inte gå upp i sig självt." }, { status: 400 });
  }

  // Riktningen avgör vilket bolag som upphör. Båda hållen är riktiga ärenden:
  // en koncern som vill samla sina kort under moderbolaget, och ett bolag som
  // självt blivit uppköpt och ska hänvisa vidare till köparen.
  const companyId = viUpphor ? rad.company_id : motpartId;
  const survivorId = viUpphor ? motpartId : rad.company_id;

  const bolag = await hamtaSammanslagningsbolag(admin, [companyId, survivorId]);
  const upphorande = bolag[companyId];
  const overlevande = bolag[survivorId];

  if (!upphorande || !overlevande) {
    return NextResponse.json({ error: "Bolaget finns inte i registret." }, { status: 404 });
  }

  // Hindren visas redan här, och inte först när granskaren försöker verkställa:
  // det är bolaget självt som måste säga upp prenumerationen i Stripes portal,
  // och de ska veta det i samma stund som de begär sammanslagningen.
  const hinder = hinderFor(upphorande);
  if (hinder.length) {
    return NextResponse.json({ error: hinder.join(" "), hinder }, { status: 409 });
  }

  if (overlevande.merged_into) {
    return NextResponse.json(
      {
        error: `${overlevande.name} är självt sammanslaget med ett annat bolag. Välj det bolaget i stället.`,
      },
      { status: 409 }
    );
  }

  const { data: arende, error } = await admin
    .from("merge_requests")
    .insert({
      company_id: companyId,
      survivor_id: survivorId,
      requested_by: user.id,
      reason: skal,
      effective_date: datum || null,
      message: meddelande?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Det partiella unika indexet släpper bara igenom ett öppet ärende per
    // bolag. Utan det kunde samma bolag ligga i kön tre gånger med tre olika
    // överlevande, och utfallet bero på vilken rad granskaren klickade på.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Det finns redan ett öppet ärende för bolaget. Vi hör av oss så snart det är granskat." },
        { status: 409 }
      );
    }
    console.error("Kunde inte skapa sammanslagningsärendet:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte skicka begäran. Försök igen." }, { status: 500 });
  }

  // Utan notisen upptäcks ärendet bara av den som råkar titta i kön, och bolaget
  // väntar på ett besked som aldrig kommer. Misslyckat mejl får inte fälla
  // begäran — den ligger redan i kön.
  await sendSammanslagningTillAdmins({
    upphorande: `${upphorande.name} (id ${upphorande.id})`,
    overlevande: `${overlevande.name} (id ${overlevande.id})`,
    skal,
    epost: user.email,
    meddelande: meddelande?.trim() || null,
  }).catch((err) => console.error("Kunde inte skicka notis om sammanslagning:", err.message));

  return NextResponse.json({
    id: arende?.id ?? null,
    arenden: await hamtaArenden(admin, rad.company_id),
  });
}

// Drar tillbaka ett öppet ärende. Ett bolag som ändrat sig ska inte behöva mejla
// för att stoppa något som ännu inte verkställts.
export async function DELETE(request) {
  const limited = await rateLimit(request, "mina-sidor-sammanslagning", 10, 3600);
  if (limited) return limited;

  const { fel, admin, rad } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { arendeId } = body;
  if (typeof arendeId !== "string" || !arendeId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: arende } = await admin
    .from("merge_requests")
    .select("id, company_id, survivor_id, status")
    .eq("id", arendeId)
    .maybeSingle();

  // Samma svar oavsett om ärendet saknas eller tillhör någon annan — annars går
  // det att lista ut vilka ärenden som finns genom att prova sig fram.
  if (!arende || ![arende.company_id, arende.survivor_id].includes(rad.company_id)) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (arende.status !== "pending") {
    return NextResponse.json({ error: "Ärendet är redan avgjort." }, { status: 409 });
  }

  const { error } = await admin.from("merge_requests").delete().eq("id", arendeId);

  if (error) {
    console.error("Kunde inte dra tillbaka ärendet:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte dra tillbaka. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ arenden: await hamtaArenden(admin, rad.company_id) });
}
