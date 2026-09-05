import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";
import { sendInquiryConfirmationToRequester, sendModerationAlertToAdmins } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ett tak, inte en exakt gräns: syftet är att stoppa orimliga anrop, inte att
// spegla hur många bolag registret råkar innehålla just nu.
const MAX_MOTTAGARE = 200;
const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));
const VALID_SERVICES = new Set(["Bemanning", "Rekrytering", "Interim", "Search"]);
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
    (service && !VALID_SERVICES.has(service)) ||
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

  if (!websiteDomain || emailDomain !== websiteDomain) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha er webbplats (${websiteDomain || "okänd domän"}).` },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  // Slå upp de valda bolagen. Det här är både existenskontrollen och källan till
  // namnen i mejlen — tidigare hämtades namnen ur den statiska filen, som inte
  // känner till bolag som tillkommit i registret sedan senaste driftsättning.
  const { data: valdaBolag, error: bolagError } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", companyIds);

  if (bolagError) {
    console.error("Kunde inte slå upp valda bolag:", JSON.stringify(bolagError));
    return NextResponse.json({ error: "Kunde inte spara förfrågan. Försök igen." }, { status: 500 });
  }

  if (!valdaBolag || valdaBolag.length !== companyIds.length) {
    return NextResponse.json(
      { error: "Ett eller flera av de valda bolagen finns inte längre i registret." },
      { status: 400 }
    );
  }

  const { data: inquiry, error: inquiryError } = await supabase
    .from("inquiries")
    .insert({
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
    })
    .select("id")
    .single();

  if (inquiryError || !inquiry) {
    console.error("Kunde inte spara förfrågan:", JSON.stringify(inquiryError));
    return NextResponse.json({ error: "Kunde inte spara förfrågan. Försök igen." }, { status: 500 });
  }

  const recipients = companyIds.map((companyId) => ({ inquiry_id: inquiry.id, company_id: companyId }));
  const { error: recipientsError } = await supabase.from("inquiry_recipients").insert(recipients);

  if (recipientsError) {
    console.error("Kunde inte spara mottagare:", JSON.stringify(recipientsError));
    return NextResponse.json({ error: "Kunde inte spara förfrågan. Försök igen." }, { status: 500 });
  }

  const companyNames = valdaBolag.map((c) => c.name);

  const inquiryForEmail = {
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
    companyNames,
  };

  // Bekräftelse till avsändaren och granskningsnotis till plattformsadmin
  // skickas alltid — best effort, misslyckas aldrig hela requesten.
  // Mejl till BOLAGEN som fått förfrågan är medvetet pausat tills Josef
  // säger till — se sendInquiryReceivedToCompany i lib/email.js.
  await Promise.allSettled([
    sendInquiryConfirmationToRequester(inquiryForEmail),
    sendModerationAlertToAdmins(inquiryForEmail),
  ]);

  return NextResponse.json({ ok: true, count: recipients.length });
}
