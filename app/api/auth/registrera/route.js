import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";

const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));
const VALID_SERVICES = new Set(["Bemanning", "Rekrytering", "Interim", "Search"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
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
  const limited = await rateLimit(request, "registrera", 5, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { userId, email, companyName, orgNumber, gatuadress, postnummer, postort, website, focusAreas, services, turnstileToken } = body;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const POSTNUMMER_RE = /^\d{3}\s?\d{2}$/;

  const focusAreasValid =
    Array.isArray(focusAreas) && focusAreas.length > 0 && focusAreas.length <= 21 &&
    focusAreas.every((a) => VALID_AREAS.has(a));
  const servicesValid =
    Array.isArray(services) && services.length > 0 && services.length <= 4 &&
    services.every((s) => VALID_SERVICES.has(s));

  if (
    typeof userId !== "string" ||
    !UUID_RE.test(userId) ||
    typeof email !== "string" ||
    !EMAIL_RE.test(email) ||
    email.length > 254 ||
    !isValidText(companyName, 200) ||
    !isValidText(orgNumber, 20) ||
    !isValidText(gatuadress, 200) ||
    !isValidText(postnummer, 10) ||
    !POSTNUMMER_RE.test(postnummer.trim()) ||
    !isValidText(postort, 100) ||
    !isValidText(website, 200) ||
    !focusAreasValid ||
    !servicesValid
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const websiteDomain = domainOf(website.trim());
  const emailDomain = email.split("@")[1]?.toLowerCase();

  if (!websiteDomain || emailDomain !== websiteDomain) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha bolagets webbplats (${websiteDomain || "okänd domän"}).` },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("company_admins").insert({
    user_id: userId,
    company_id: null,
    claimed_company_name: companyName.trim(),
    claimed_org_number: orgNumber.trim(),
    // Formuläret frågar efter gatuadress, postnummer och postort var för sig;
    // databasen har en adressrad, så delarna sätts ihop här.
    claimed_address: `${gatuadress.trim()}, ${postnummer.trim()} ${postort.trim()}`,
    claimed_website: website.trim(),
    claimed_focus_areas: focusAreas,
    claimed_services: services,
    verified: false,
  });

  if (error) {
    console.error("Kunde inte spara bolagsanspråk:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara begäran. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
