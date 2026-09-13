import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaRegisterstatus } from "@/lib/foretagsuppslag";
import { sendAvregistreradeTillAdmins } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel avbryter funktionen vid taket oavsett vad vi sätter här; 60 sekunder är
// det som gäller på alla planer. Tidsbudgeten nedan ligger under det, så jobbet
// hinner spara det den gjort i stället för att dödas mitt i.
export const maxDuration = 60;

// Bolagsverket tillåter 60 anrop i minuten och slår upp ETT organisationsnummer
// per anrop — en lista ger 400 (provat 2026-09-13). Därför en paus mellan varje,
// med lite marginal.
const PAUS_MS = 1100;
const BUDGET_MS = 45_000;
// Ett uppslag tar ~1,4 sekunder med pausen inräknad (uppmätt mot skarpa API:et),
// så 28 bolag ryms i budgeten med marginal. Budgeten är säkerhetsnätet, inte
// takten — annars hade varje körning rapporterat ett avbrott som inte var ett fel.
const ANTAL_PER_KORNING = 28;

// Fem misslyckade uppslag i rad är inte fem trasiga bolag, det är Bolagsverket
// som ligger nere eller en nyckel som slutat gälla. Då avbryts körningen utan att
// något märks som kontrollerat, så att bolagen står kvar först i kön i morgon.
const AVBRYT_EFTER_FEL_I_RAD = 5;

const paus = (ms) => new Promise((r) => setTimeout(r, ms));

// Kontrollerar registret mot Bolagsverket, en bit i taget.
//
// Vad jobbet gör: skriver ner om ett bolag är avregistrerat, och när. Vad det
// INTE gör: döljer bolaget. Ett avregistrerat bolag kan ha gått upp i ett annat
// (då ska profilen peka dit) eller helt enkelt ha upphört (då ska den ligga kvar
// och säga det) — den skillnaden går inte att läsa ur registret, så beslutet
// hamnar i kön på /admin/sammanslagningar.
//
// Turordning: äldst kontrollerade först, aldrig kontrollerade allra först. Varje
// bolag med organisationsnummer kommer med i tur och ordning, och inget kan bli
// stående.
//
// Takten räcker till underhåll, inte till ett första svep: 28 bolag per natt tar
// ett register på 3 770 bolag runt fyra månader att varva. Kör
// scripts/koll-avregistrerade.mjs en gång för att beta av registret från början —
// det tar en dryg timme och lämnar en CSV att granska i stället för att skriva
// direkt i produktionen.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET saknas — registerkontrollen vägrar köra oskyddad.");
    return NextResponse.json({ error: "Saknar konfiguration." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  if (!process.env.BOLAGSVERKET_CLIENT_ID || !process.env.BOLAGSVERKET_CLIENT_SECRET) {
    console.error("BOLAGSVERKET_CLIENT_ID/_SECRET saknas — registerkontrollen kan inte köra.");
    return NextResponse.json({ error: "Saknar konfiguration." }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const antal = Math.min(500, Math.max(1, Number(params.get("antal")) || ANTAL_PER_KORNING));
  const budget = Math.min(280_000, Math.max(5_000, Number(params.get("budget")) || BUDGET_MS));
  const slutar = Date.now() + budget;

  const admin = createAdminClient();

  const { data: bolag, error } = await admin
    .from("companies")
    .select("id, name, org_number, deregistered_at")
    .not("org_number", "is", null)
    .is("retired_at", null)
    .order("bolagsverket_checked_at", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true })
    .limit(antal);

  if (error) {
    // Saknas kolumnerna är migrationen inte körd. Det ska synas som ett fel och
    // inte som en lyckad körning utan träffar.
    console.error("Registerkontrollen kunde inte läsa bolagen:", JSON.stringify(error));
    return NextResponse.json(
      { error: "Kunde inte läsa bolagen. Är supabase/migration_sammanslagning.sql körd?" },
      { status: 500 }
    );
  }

  const nyaAvregistrerade = [];
  let kontrollerade = 0;
  let felIRad = 0;
  let fel = 0;
  let ejHittade = 0;
  let avbrott = null;

  for (const b of bolag ?? []) {
    if (Date.now() > slutar) {
      avbrott = "tidsbudgeten tog slut";
      break;
    }

    const status = await hamtaRegisterstatus(b.org_number);

    if (status.status === "fel") {
      fel++;
      felIRad++;
      if (felIRad >= AVBRYT_EFTER_FEL_I_RAD) {
        avbrott = `${felIRad} uppslag i rad misslyckades (${status.fel}) — Bolagsverket svarar inte som det ska`;
        console.error(`Registerkontrollen avbröts: ${avbrott}`);
        break;
      }
      // Enstaka fel ska inte få bolaget att blockera kön för alltid: det märks
      // som kontrollerat och kommer tillbaka sist i turordningen.
      await admin
        .from("companies")
        .update({ bolagsverket_checked_at: new Date().toISOString() })
        .eq("id", b.id);
      await paus(PAUS_MS);
      continue;
    }

    felIRad = 0;
    kontrollerade++;

    if (status.status !== "ok") {
      // Ogiltigt eller okänt organisationsnummer säger något om VÅR uppgift, inte
      // om bolaget. Det får aldrig tolkas som en avregistrering.
      if (status.status === "ej-hittad") ejHittade++;
      await admin
        .from("companies")
        .update({ bolagsverket_checked_at: new Date().toISOString() })
        .eq("id", b.id);
      await paus(PAUS_MS);
      continue;
    }

    const datum = status.avregistreringsdatum || null;

    const { error: skrivFel } = await admin
      .from("companies")
      .update({
        bolagsverket_checked_at: new Date().toISOString(),
        deregistered_at: datum,
        bolagsverket_active: status.aktiv,
      })
      .eq("id", b.id);

    if (skrivFel) {
      console.error(`Kunde inte spara registerläget för bolag ${b.id}:`, JSON.stringify(skrivFel));
    } else if (datum && !b.deregistered_at) {
      nyaAvregistrerade.push({ id: b.id, namn: b.name, orgnr: b.org_number, datum });
    }

    await paus(PAUS_MS);
  }

  // Bara de nya. Ett bolag som redan låg i kön ska inte mejlas om varje natt
  // tills någon hinner ta ställning — då slutar man läsa notiserna.
  if (nyaAvregistrerade.length) {
    console.warn(`Registerkontrollen hittade ${nyaAvregistrerade.length} nya avregistrerade bolag.`);
    await sendAvregistreradeTillAdmins({ bolag: nyaAvregistrerade }).catch((err) =>
      console.error("Kunde inte skicka notis om avregistrerade bolag:", err.message)
    );
  }

  return NextResponse.json({
    kontrollerade,
    nyaAvregistrerade: nyaAvregistrerade.length,
    ejHittade,
    fel,
    avbrott,
  });
}
