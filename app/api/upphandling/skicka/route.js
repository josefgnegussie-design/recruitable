import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";
import { arGratisadress } from "@/lib/gratisadresser";
import { fornamn } from "@/lib/inquiries";
import { valideraKontakt, valideraUpphandling } from "@/lib/upphandling";
import { koparSokvag, nyKopartoken } from "@/lib/upphandlingRepo";
import { sendUpphandlingAttGranska, sendUpphandlingKvitto } from "@/lib/emailUpphandling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function domainOf(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Köparen lägger ut en upphandling. Inget konto krävs, så samma spärrar som för
// en förfrågan gäller: Turnstile, e-post på företagets egen domän och granskning
// innan något syns. Inga leverantörer mejlas härifrån, det sker vid godkännandet.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-skicka", 5, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { fel, rad } = valideraUpphandling(body);
  if (fel) return NextResponse.json({ error: fel }, { status: 400 });

  const kontakt = body.kontakt || {};
  if (!valideraKontakt(kontakt)) {
    return NextResponse.json({ error: "Fyll i alla kontaktuppgifter." }, { status: 400 });
  }

  if (!(await verifyTurnstile(body.turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const epost = kontakt.epost.trim();
  const epostDoman = epost.split("@")[1]?.toLowerCase();
  const webbDoman = domainOf(kontakt.webbplats.trim());
  if (arGratisadress(epostDoman)) {
    return NextResponse.json({ error: "Använd din jobbadress på företagets egen domän." }, { status: 403 });
  }
  if (!webbDoman || webbDoman !== epostDoman) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha er webbplats (${webbDoman || "okänd domän"}).` },
      { status: 403 }
    );
  }

  const { token, tokenHash } = nyKopartoken();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("procurements")
    .insert({
      ...rad,
      requester_name: kontakt.namn.trim(),
      requester_email: epost,
      requester_website: kontakt.webbplats.trim(),
      requester_role: kontakt.roll.trim(),
      requester_company: kontakt.foretag.trim(),
      requester_city: kontakt.ort.trim(),
      requester_phone: kontakt.telefon?.trim() || null,
      token_hash: tokenHash,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Kunde inte spara upphandling:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara upphandlingen. Försök igen." }, { status: 500 });
  }

  const lank = koparSokvag(token);

  // Kvittot är det enda stället länken finns att få, utöver svaret här.
  after(() =>
    Promise.allSettled([
      sendUpphandlingKvitto({ till: epost, fornamn: fornamn(kontakt.namn), titel: rad.title, lank }),
      sendUpphandlingAttGranska({
        foretag: kontakt.foretag.trim(),
        namn: kontakt.namn.trim(),
        titel: rad.title,
        beskrivning: rad.description,
      }),
    ])
  );

  return NextResponse.json({ ok: true, lank });
}
