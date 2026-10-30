import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaAdministratorer, kravBolagsadmin } from "@/lib/bolagsadmin";
import {
  INBJUDAN_GILTIG_DAGAR,
  domanUrEpost,
  domanUrWebbadress,
  hamtaInbjudningar,
  nyInbjudningstoken,
} from "@/lib/inbjudningar";
import { sendInbjudanTillKollega } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bjuder in en kollega med e-post. Bara ägaren får göra det.
//
// Adressen måste ha bolagets domän, precis som vid registreringen: den som
// klickar på länken blir verifierad administratör utan granskning, så ägaren
// ska inte kunna ge tillgång till en adress utanför bolaget. Godtagna domäner
// är ägarens egen mejldomän — som kontrollerades mot webbplatsen när kontot
// registrerades — och domänen i bolagets webbplats.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-inbjudan", 20, 3600);
  if (limited) return limited;

  const { fel, admin, rad, user } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const epost = typeof body.epost === "string" ? body.epost.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(epost) || epost.length > 254) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  const { data: company } = await admin.from("companies").select("name, link").eq("id", rad.company_id).single();

  const godkanda = [...new Set([domanUrEpost(user.email), domanUrWebbadress(company?.link)].filter(Boolean))];
  if (!godkanda.includes(domanUrEpost(epost))) {
    return NextResponse.json(
      {
        error: `Bara adresser på bolagets domän kan bjudas in (${godkanda.map((d) => "@" + d).join(" eller ")}). Hör av er till info@recruitable.se om kollegan har en annan adress.`,
      },
      { status: 400 }
    );
  }

  const administratorer = await hamtaAdministratorer(admin, rad.company_id);
  if (administratorer.some((a) => a.epost?.toLowerCase() === epost)) {
    return NextResponse.json({ error: "Adressen är redan administratör här." }, { status: 400 });
  }

  // En ny inbjudan till samma adress ersätter den förra, så att bara den
  // senaste länken fungerar. Den som inte hittar mejlet kan alltså be om ett nytt.
  await admin
    .from("bolagsinbjudningar")
    .update({ aterkallad_at: new Date().toISOString() })
    .eq("company_id", rad.company_id)
    .eq("epost", epost)
    .is("antagen_at", null)
    .is("aterkallad_at", null);

  const { token, tokenHash } = nyInbjudningstoken();
  const { error } = await admin.from("bolagsinbjudningar").insert({
    company_id: rad.company_id,
    epost,
    token_hash: tokenHash,
    inbjuden_av: user.id,
    giltig_till: new Date(Date.now() + INBJUDAN_GILTIG_DAGAR * 24 * 3600 * 1000).toISOString(),
  });

  if (error) {
    const saknadTabell = error.code === "42P01" || error.code === "PGRST205";
    console.error(
      saknadTabell
        ? "bolagsinbjudningar saknas — kör supabase/migration_inbjudningar.sql."
        : `Kunde inte spara inbjudan: ${JSON.stringify(error)}`
    );
    return NextResponse.json({ error: "Kunde inte skapa inbjudan. Försök igen." }, { status: 500 });
  }

  // Inväntas: utan mejlet är inbjudan värdelös, och ägaren ska få veta om det
  // inte gick iväg i stället för att vänta på en kollega som aldrig fick något.
  const skickat = await sendInbjudanTillKollega({
    to: epost,
    companyName: company?.name || "ert bolag",
    franEpost: user.email,
    token,
    giltigDagar: INBJUDAN_GILTIG_DAGAR,
  });

  if (!skickat || skickat.error) {
    return NextResponse.json(
      {
        error: "Inbjudan sparades men mejlet kunde inte skickas. Försök igen om en stund.",
        inbjudningar: await hamtaInbjudningar(admin, rad.company_id),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ inbjudningar: await hamtaInbjudningar(admin, rad.company_id) });
}

// Återkallar en inbjudan som inte använts. Länken i mejlet slutar då fungera.
export async function DELETE(request) {
  const limited = await rateLimit(request, "konto-inbjudan", 20, 3600);
  if (limited) return limited;

  const { fel, admin, rad } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { inbjudanId } = body;
  if (typeof inbjudanId !== "string" || !inbjudanId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  // company_id i villkoret: en ägare kan bara återkalla sitt eget bolags
  // inbjudningar, även med ett id som hör till ett annat.
  const { data: aterkallad, error } = await admin
    .from("bolagsinbjudningar")
    .update({ aterkallad_at: new Date().toISOString() })
    .eq("id", inbjudanId)
    .eq("company_id", rad.company_id)
    .is("antagen_at", null)
    .is("aterkallad_at", null)
    .select("id");

  if (error) {
    console.error("Kunde inte återkalla inbjudan:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte återkalla. Försök igen." }, { status: 500 });
  }
  if (!aterkallad?.length) {
    return NextResponse.json({ error: "Inbjudan finns inte eller har redan använts." }, { status: 404 });
  }

  return NextResponse.json({ inbjudningar: await hamtaInbjudningar(admin, rad.company_id) });
}
