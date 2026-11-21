import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { YRKESOMRADEN, GILTIGA_TJANSTER } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { arGratisadress } from "@/lib/gratisadresser";
import { domanTarEmotMejl } from "@/lib/automatiskGranskning";
import { clientIp } from "@/lib/requestIp";
import { sparaOchSkickaForfragan } from "@/lib/forfraganSkickas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ett tak, inte en exakt gräns: syftet är att stoppa orimliga anrop, inte att
// spegla hur många bolag registret råkar innehålla just nu.
const MAX_MOTTAGARE = 200;
const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

function isValidOptionalText(v, maxLen) {
  return v === undefined || v === null || (typeof v === "string" && v.length <= maxLen);
}

function domainOf(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function POST(request) {
  const limited = await rateLimit(request, "forfragan-skicka", 10, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const {
    companyIds,
    description,
    searchRole,
    focusArea,
    service,
    region,
    city,
    requesterName,
    requesterEmail,
    requesterWebsite,
    requesterRole,
    requesterCompany,
    requesterCity,
    requesterPhone,
    turnstileToken,
  } = body;

  // Att bolagen verkligen finns kontrolleras mot databasen längre ner, inte mot
  // en lista som låsts vid modulladdning. Ett nyss godkänt bolag ska kunna ta
  // emot förfrågningar direkt, utan att sajten först driftsätts om.
  const companyIdsValid =
    Array.isArray(companyIds) &&
    companyIds.length > 0 &&
    companyIds.length <= MAX_MOTTAGARE &&
    companyIds.every((id) => Number.isInteger(id) && id > 0);

  if (
    !companyIdsValid ||
    !isValidText(description, 350) ||
    !isValidOptionalText(searchRole, 45) ||
    (focusArea && !VALID_AREAS.has(focusArea)) ||
    (service && !GILTIGA_TJANSTER.has(service)) ||
    !isValidOptionalText(region, 100) ||
    !isValidOptionalText(city, 100) ||
    !isValidText(requesterName, 100) ||
    typeof requesterEmail !== "string" ||
    !EMAIL_RE.test(requesterEmail) ||
    requesterEmail.length > 254 ||
    !isValidText(requesterWebsite, 200) ||
    !isValidText(requesterRole, 100) ||
    !isValidText(requesterCompany, 200) ||
    !isValidText(requesterCity, 100) ||
    !isValidOptionalText(requesterPhone, 30)
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const websiteDomain = domainOf(requesterWebsite.trim());
  const emailDomain = requesterEmail.split("@")[1]?.toLowerCase();

  // Formuläret säger samma sak redan när fältet lämnas, men servern får inte
  // lita på det: en gmail.com-adress med gmail.com som webbplats gick annars
  // igenom domänkontrollen nedan.
  if (arGratisadress(emailDomain)) {
    return NextResponse.json({ error: "Använd din jobbadress på företagets egen domän." }, { status: 403 });
  }

  if (!websiteDomain || emailDomain !== websiteDomain) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha er webbplats (${websiteDomain || "okänd domän"}).` },
      { status: 403 }
    );
  }

  // Bekräftelsemejlet måste kunna komma fram, annars kan förfrågan aldrig
  // skickas vidare. Bättre att säga det nu än att låta avsändaren vänta.
  if (!(await domanTarEmotMejl(emailDomain))) {
    return NextResponse.json(
      { error: `Vi kan inte skicka mejl till ${emailDomain}. Kontrollera att adressen är rätt stavad.` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const forfraganRad = {
    search_role: searchRole || null,
    focus_area: focusArea || null,
    service: service || null,
    region: region || null,
    city: city || null,
    description: description.trim(),
    requester_name: requesterName.trim(),
    requester_email: requesterEmail.trim(),
    requester_website: requesterWebsite.trim(),
    requester_role: requesterRole.trim(),
    requester_company: requesterCompany.trim(),
    requester_city: requesterCity.trim(),
    requester_phone: requesterPhone?.trim() || null,
  };

  const mejl = {
    requesterName: requesterName.trim(),
    requesterEmail: requesterEmail.trim(),
    requesterRole: requesterRole.trim(),
    requesterCompany: requesterCompany.trim(),
    requesterCity: requesterCity.trim(),
    requesterWebsite: requesterWebsite.trim(),
    requesterPhone: requesterPhone?.trim() || "",
    region: region || "",
    description: description.trim(),
    searchRole: searchRole || "",
    focusArea: focusArea || "",
    service: service || "",
  };

  // Resten — bolagen, mottagarna, uppföljningslänken och mejlen — delas med
  // inbjudningarna från Upphandling. Se lib/forfraganSkickas.js.
  const { svar, fel, status } = await sparaOchSkickaForfragan(supabase, { rad: forfraganRad, companyIds, mejl });
  if (fel) return NextResponse.json({ error: fel }, { status });
  return NextResponse.json(svar);
}
