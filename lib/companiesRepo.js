// Registret läses härifrån, inte längre direkt ur lib/companies.js.
//
// Bakgrund: den statiska filen rymmer 59 bolag på 56 kB och skickas i sin helhet
// till varje besökares webbläsare, eftersom sökningen filtrerar listan lokalt.
// Vid ett par tusen bolag blir det närmare två megabyte JavaScript före första
// sökningen, och varje nytt bolag kräver en kodändring och en driftsättning.
// Därför bor registret i companies-tabellen, som redan har alla fälten.
//
// Övergången är gjord så att den inte kan fälla sajten: går databasen inte att
// nå, eller är tabellen ännu inte importerad, faller allt tillbaka på den
// statiska filen och besökaren märker ingen skillnad. Fältet `kalla` i svaret
// talar om vilken väg som användes.

import { createPublicClient } from "@/lib/supabase/public";
import { COMPANIES } from "@/lib/companies";
import { filterCompanies } from "@/lib/helpers";

const KOLUMNER =
  "id, name, city, address, office_cities, lat, lng, auktorisation, focus, services, " +
  "size_band, ka, founded, revenue, revenue_year, employees, employees_year, " +
  "rating, rating_count, vision, description, contact, link, logo, is_premium, claimed, " +
  "verksamhetsbeskrivning, klassificering_harledd";

export const SIDSTORLEK = 24;

// Om tabellen är tom är registret ännu inte importerat. Svaret cachas kort, så
// att en tom tabell inte ger en extra räkning vid varje sökning.
let tomKontroll = { tom: null, utgar: 0 };
const TOM_CACHE_MS = 60 * 1000;

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    officeCities: row.office_cities ?? [],
    lat: row.lat,
    lng: row.lng,
    auktorisation: row.auktorisation ?? [],
    focus: row.focus ?? [],
    services: row.services ?? [],
    sizeBand: row.size_band,
    ka: row.ka,
    founded: row.founded,
    revenue: row.revenue,
    revenueYear: row.revenue_year,
    employees: row.employees,
    employeesYear: row.employees_year,
    rating: row.rating == null ? null : Number(row.rating),
    ratingCount: row.rating_count,
    vision: row.vision,
    // Komponenterna använder `desc`; kolumnen heter description eftersom desc
    // är ett reserverat ord i SQL.
    desc: row.description,
    contact: row.contact,
    link: row.link,
    logo: row.logo,
    isPremium: row.is_premium ?? false,
    // Falskt även för bolagen ur den statiska filen: ingen av dem har tagits
    // över av sitt bolag ännu.
    claimed: row.claimed ?? false,
    // Bolagets egen formulering ur bolagsordningen, hämtad från Bolagsverket.
    verksamhetsbeskrivning: row.verksamhetsbeskrivning ?? null,
    // Sanna när yrkesområde och tjänst är slutsatser dragna ur den texten och
    // inte uppgifter bolaget självt lämnat.
    klassificeringHarledd: row.klassificering_harledd ?? false,
  };
}

// Ortsfiltret blir en PostgREST-uttryckssträng, där komma och parentes har egen
// betydelse. Allt som inte hör hemma i ett ortsnamn plockas därför bort innan
// värdet stoppas in — annars kan ett filter förvandlas till något annat.
function rensaOrt(ort) {
  return String(ort || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();
}

async function tabellenArTom(supabase) {
  if (tomKontroll.tom !== null && tomKontroll.utgar > Date.now()) return tomKontroll.tom;

  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });

  if (error) throw error;

  tomKontroll = { tom: (count ?? 0) === 0, utgar: Date.now() + TOM_CACHE_MS };
  return tomKontroll.tom;
}

function franStatiskFil({ omrade, tjanst, ort, sida, antal, endastKompletta }) {
  let traffar = filterCompanies(COMPANIES, { omrade, service: tjanst, ort });
  if (endastKompletta) traffar = traffar.filter((c) => c.vision);
  const fran = (sida - 1) * antal;
  return {
    bolag: traffar.slice(fran, fran + antal),
    totalt: traffar.length,
    kalla: "statisk fil",
  };
}

// Söker i registret. Returnerar en sida i taget — hela listan ska aldrig behöva
// skickas till webbläsaren.
export async function hamtaBolag({
  omrade = "",
  tjanst = "",
  ort = "",
  sida = 1,
  antal = SIDSTORLEK,
  // Bara bolag som har en vision, alltså en profil någon skrivit. Registret
  // innehåller tusentals bolag hämtade ur offentliga källor, och deras kort
  // skulle bli tomma citattecken utan taggar. Används där bolag ställs ut som
  // exempel — inte i sökningen, där alla ska kunna hittas.
  endastKompletta = false,
} = {}) {
  const sidnummer = Math.max(1, Number(sida) || 1);
  const sidstorlek = Math.min(100, Math.max(1, Number(antal) || SIDSTORLEK));
  const reserv = () =>
    franStatiskFil({ omrade, tjanst, ort, sida: sidnummer, antal: sidstorlek, endastKompletta });

  try {
    const supabase = createPublicClient();

    if (await tabellenArTom(supabase)) return reserv();

    let fraga = supabase.from("companies").select(KOLUMNER, { count: "exact" });

    if (omrade) fraga = fraga.contains("focus", [omrade]);
    if (tjanst) fraga = fraga.contains("services", [tjanst]);
    if (endastKompletta) fraga = fraga.not("vision", "is", null);

    const rensad = rensaOrt(ort);
    if (rensad) fraga = fraga.or(`city.eq.${rensad},address.ilike.*${rensad}*`);

    const fran = (sidnummer - 1) * sidstorlek;
    const { data, error, count } = await fraga.order("name").range(fran, fran + sidstorlek - 1);

    if (error) throw error;

    return { bolag: (data ?? []).map(fromRow), totalt: count ?? 0, kalla: "databas" };
  } catch (err) {
    console.error("Kunde inte läsa registret ur databasen, använder statiska filen:", err.message);
    return reserv();
  }
}

// Ett enskilt bolag. Samma reservväg som ovan.
export async function hamtaBolagMedId(id) {
  const nummer = Number(id);
  if (!Number.isInteger(nummer)) return null;

  try {
    const supabase = createPublicClient();

    if (await tabellenArTom(supabase)) {
      return COMPANIES.find((c) => c.id === nummer) ?? null;
    }

    const { data, error } = await supabase
      .from("companies")
      .select(KOLUMNER)
      .eq("id", nummer)
      .maybeSingle();

    if (error) throw error;
    return data ? fromRow(data) : null;
  } catch (err) {
    console.error(`Kunde inte läsa bolag ${nummer} ur databasen, använder statiska filen:`, err.message);
    return COMPANIES.find((c) => c.id === nummer) ?? null;
  }
}

// Ett blandat urval till "Urval av bolag" på /rekrytera. Slumpen ligger här och
// inte i sidan, eftersom en komponents rendering ska vara förutsägbar — och för
// att databasen inte kan sortera slumpmässigt via PostgREST.
export async function hamtaUrval(antal = 6, poolStorlek = 24) {
  const { bolag } = await hamtaBolag({ antal: poolStorlek, endastKompletta: true });
  const blandad = [...bolag];
  for (let i = blandad.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blandad[i], blandad[j]] = [blandad[j], blandad[i]];
  }
  return blandad.slice(0, antal);
}

// Hur många bolag registret innehåller — används i rubriker ("59 bolag i
// registret") och ska visa den verkliga siffran, inte filens.
export async function raknaBolag() {
  try {
    const supabase = createPublicClient();
    const { count, error } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count && count > 0 ? count : COMPANIES.length;
  } catch {
    return COMPANIES.length;
  }
}
