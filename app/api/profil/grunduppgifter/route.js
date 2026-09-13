import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { YRKESOMRADEN, GILTIGA_TJANSTER } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";
import { giltigaAdresser, normaliseraAdress, orterUrAdresser } from "@/lib/adresser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));
const VALID_ROLES = new Set(Object.values(YRKESOMRADEN).flat());

const MAX_BILDSPEL = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Enda vägen in för allt bolaget skriver om sig självt. Undersökningarna låg
// tidigare i /api/profil/spara bakom premium — de flyttade hit när profilen
// blev gratis, så att ett sparat formulär är en skrivning och inte två.
function giltigUndersokning(v) {
  if (v === null || v === undefined) return true;
  if (typeof v !== "object") return false;
  const { score, source } = v;
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 1 &&
    score <= 5 &&
    typeof source === "string" &&
    source.length <= 200
  );
}

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

  const { companyId, vision, description, focus, services, recruitingRoles, link, contact, ka, logo, slideshow, addresses, surveys } =
    body;

  const text = (v, max) => typeof v === "string" && v.length <= max;
  const lista = (v, giltiga, max) =>
    Array.isArray(v) && v.length <= max && v.every((x) => giltiga.has(x));

  const webbplatsOk =
    !link ||
    (typeof link === "string" &&
      link.length <= 200 &&
      /^https?:\/\/|^www\./i.test(link));

  const bildOk = (v) =>
    typeof v === "string" && v.length <= 2000 && (v.startsWith("/") || v.startsWith("https://"));

  const loggaOk = !logo || bildOk(logo);

  // Taket sätts även här och inte bara i formuläret — gränsen finns för att
  // profilen ska gå att överblicka, och den som postar direkt mot routen ska
  // inte kunna kringgå den.
  const bildspelOk =
    Array.isArray(slideshow) && slideshow.length <= MAX_BILDSPEL && slideshow.every(bildOk);

  const adresserOk = giltigaAdresser(addresses);

  if (
    !Number.isInteger(companyId) ||
    !text(vision, 500) ||
    !text(description, 2000) ||
    !lista(focus, VALID_AREAS, 21) ||
    !lista(services, GILTIGA_TJANSTER, 4) ||
    // Taket är hela taxonomin: ett bolag som rekryterar brett ska kunna säga det.
    !lista(recruitingRoles, VALID_ROLES, VALID_ROLES.size) ||
    !webbplatsOk ||
    !loggaOk ||
    !bildspelOk ||
    !adresserOk ||
    typeof ka !== "boolean" ||
    (contact && (typeof contact !== "string" || contact.length > 254 || !EMAIL_RE.test(contact))) ||
    typeof surveys !== "object" ||
    surveys === null ||
    !giltigUndersokning(surveys.customer_satisfaction) ||
    !giltigUndersokning(surveys.employee_satisfaction)
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  const normaliserade = addresses.map(normaliseraAdress);

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
      recruiting_roles: recruitingRoles,
      link: link?.trim() || null,
      contact: contact?.trim() || null,
      ka,
      logo: logo?.trim() || null,
      slideshow,
      addresses: normaliserade,
      // Härleds ur adresserna i stället för att fyllas i separat. office_cities
      // är det sökkorten och profilens Snabbfakta läser, och två fält för samma
      // uppgift skulle förr eller senare säga emot varandra. Dubbletter faller
      // bort och ordningen behålls — bolaget har lagt adresserna i den ordning
      // de vill bli lästa.
      office_cities: orterUrAdresser(normaliserade),
      surveys,
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
    // Saknad kolumn betyder att en migration inte körts mot den här databasen.
    // Det har hänt förut och märktes då bara som att sparandet "inte fungerade" —
    // därför sägs det rakt ut i stället för att gömmas bakom ett allmänt fel.
    if (error.code === "42703" || error.code === "PGRST204") {
      return NextResponse.json(
        { error: "Databasen saknar ett fält som formuläret sparar. Kör migrationerna i supabase/." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kunde inte spara. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
