import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";
import { arGratisadress } from "@/lib/gratisadresser";
import { domanTarEmotMejl } from "@/lib/automatiskGranskning";
import { sparaOchSkickaForfragan } from "@/lib/forfraganSkickas";
import { valideraInbjudan } from "@/lib/upphandlingInbjudan";
import { arbetsstalleFran } from "@/lib/arbetsstalle";
import { narhetForBolag } from "@/lib/upphandlingMatchning";

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

// Köparen bjuder in de bolag den valt ut. Inget konto krävs, och samma spärrar
// som för en förfrågan från Rekrytera gäller: Turnstile, e-post på företagets
// egen domän och bekräftelse via mejl innan bolagen får något. Därefter går inbjudan
// samma väg som en förfrågan, se lib/forfraganSkickas.js.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-skicka", 5, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { fel, rad, companyIds, extra, reserv, mejl } = valideraInbjudan(body, arbetsstalleFran);
  if (fel) return NextResponse.json({ error: fel }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const epostDoman = rad.requester_email.split("@")[1]?.toLowerCase();
  const webbDoman = domainOf(rad.requester_website);
  if (arGratisadress(epostDoman)) {
    return NextResponse.json({ error: "Använd din jobbadress på företagets egen domän." }, { status: 403 });
  }
  if (!webbDoman || webbDoman !== epostDoman) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha er webbplats (${webbDoman || "okänd domän"}).` },
      { status: 403 }
    );
  }
  if (!(await domanTarEmotMejl(epostDoman))) {
    return NextResponse.json(
      { error: `Vi kan inte skicka mejl till ${epostDoman}. Kontrollera att adressen är rätt stavad.` },
      { status: 400 }
    );
  }

  // Varje bolag får se vilket av arbetsställena det har nära till. Sparas per
  // bolag i upphandlingen; mapInquiryRow lämnar bara ut bolagets egen rad.
  const narhet = await narhetForBolag(companyIds, body.arbetsstallen.map(arbetsstalleFran));
  if (narhet) extra.upphandling.narhet = narhet;

  const resultat = await sparaOchSkickaForfragan(createAdminClient(), { rad, companyIds, mejl, extra, reserv });
  if (resultat.fel) return NextResponse.json({ error: resultat.fel }, { status: resultat.status });
  return NextResponse.json(resultat.svar);
}
