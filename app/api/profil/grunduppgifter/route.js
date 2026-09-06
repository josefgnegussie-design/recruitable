import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));
const VALID_SERVICES = new Set(["Bemanning", "Rekrytering", "Interim", "Search"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Uppgifter bolaget själv svarar för. De objektiva fälten — namn, org.nummer,
// adress, omsättning, antal anställda, grundat år — går medvetet inte att ändra
// här. De kommer från Bolagsverket och årsredovisningar, och är hela skälet att
// lita på registret. Kunde ett bolag skriva om sin egen omsättning vore sajten
// inte längre opartisk.
export async function POST(request) {
  const limited = await rateLimit(request, "profil-grunduppgifter", 60, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { companyId, vision, description, focus, services, link, contact, ka, logo } = body;

  const text = (v, max) => typeof v === "string" && v.length <= max;
  const lista = (v, giltiga, max) =>
    Array.isArray(v) && v.length <= max && v.every((x) => giltiga.has(x));

  const webbplatsOk =
    !link ||
    (typeof link === "string" &&
      link.length <= 200 &&
      /^https?:\/\/|^www\./i.test(link));

  const loggaOk =
    !logo ||
    (typeof logo === "string" && logo.length <= 2000 && (logo.startsWith("/") || logo.startsWith("https://")));

  if (
    !Number.isInteger(companyId) ||
    !text(vision, 500) ||
    !text(description, 2000) ||
    !lista(focus, VALID_AREAS, 21) ||
    !lista(services, VALID_SERVICES, 4) ||
    !webbplatsOk ||
    !loggaOk ||
    typeof ka !== "boolean" ||
    (contact && (typeof contact !== "string" || contact.length > 254 || !EMAIL_RE.test(contact)))
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("verified")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!adminRow?.verified) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const { error } = await supabase
    .from("companies")
    .update({
      vision: vision.trim() || null,
      description: description.trim() || null,
      focus,
      services,
      link: link?.trim() || null,
      contact: contact?.trim() || null,
      ka,
      logo: logo?.trim() || null,
      // Uppgifterna kommer nu från bolaget självt. Profilen är därmed varken
      // oövertagen eller härledd ur bolagsordningen, och besökaren ska inte
      // längre se vare sig inbjudan att ta över den eller förbehållet om att
      // inriktningen är en gissning.
      claimed: true,
      klassificering_harledd: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) {
    console.error("Kunde inte spara grunduppgifter:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
