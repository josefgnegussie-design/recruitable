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

const GRUNDKOLUMNER =
  "id, name, city, address, office_cities, lat, lng, auktorisation, focus, services, " +
  "surveys, size_band, ka, founded, revenue, revenue_year, employees, employees_year, " +
  "rating, rating_count, vision, description, contact, link, logo, is_premium, claimed, " +
  "verksamhetsbeskrivning, klassificering_harledd";

// Kolumner som tillkommit efter att registret gått live, och som koden alltså
// kan hinna driftsättas före. Utan skyddet nedan svarar Postgres "column does
// not exist", hela SELECT:en faller, och reservvägen visar den statiska filens
// 59 bolag i stället för registrets tusentals — tyst, för besökaren ser en
// fungerande sökning med fel innehåll.
const SENA_KOLUMNER = [
  { namn: "recruiting_roles", migration: "supabase/migration_yrkesroller.sql" },
  { namn: "slideshow", migration: "supabase/migration_bildspel.sql" },
  { namn: "addresses", migration: "supabase/migration_adresser.sql" },
];

// Fylls i första gången databasen säger att en kolumn saknas, och kostar
// ingenting när migrationerna väl körts.
const saknade = new Set();

function valjKolumner() {
  const extra = SENA_KOLUMNER.filter((k) => !saknade.has(k.namn)).map((k) => k.namn);
  return extra.length ? `${GRUNDKOLUMNER}, ${extra.join(", ")}` : GRUNDKOLUMNER;
}

// Returnerar true om felet gick att lösa genom att sluta be om en kolumn, så
// att anroparen kan göra om frågan. Postgres nämner kolumnen i meddelandet;
// felkoden ensam räcker inte, eftersom 42703 också kan komma av något annat.
function hanteraSaknadKolumn(error) {
  if (!error) return false;
  const text = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;
  const traff = SENA_KOLUMNER.find((k) => !saknade.has(k.namn) && text.includes(k.namn));
  if (!traff) return false;

  console.warn(
    `companies.${traff.namn} saknas — kör ${traff.migration}. ` +
      "Registret visas utan det fältet tills dess."
  );
  saknade.add(traff.namn);
  return true;
}

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
    // Yrkesrollerna bolaget självt angett. Saknas kolumnen (reservvägen via den
    // statiska filen, eller en databas där migrationen inte körts) blir den tom
    // och korten visar inga roller i stället för att fela.
    recruitingRoles: row.recruiting_roles ?? [],
    slideshow: row.slideshow ?? [],
    addresses: row.addresses ?? [],
    surveys: row.surveys ?? null,
    sizeBand: row.size_band,
    ka: row.ka,
    founded: row.founded,
    revenue: row.revenue,
    revenueYear: row.revenue_year,
    employees: row.employees,
    employeesYear: row.employees_year,
    // Google-betyget visas inte längre någonstans. Det slogs upp för hand i
    // augusti 2026 för de dryga femtio bolag som gicks igenom då, aldrig för de
    // övriga — 21 av 3 770 hade ett betyg. Korten kunde inte skilja "kollat,
    // inga recensioner" från "aldrig kollat" och visade samma negativa rad för
    // båda, och siffran var odaterad trots att den aldrig uppdaterades. Fältet
    // hämtas ändå: värdena är handresearchade, och en riktig Places-integration
    // skulle bara behöva tända visningen igen.
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
  if (endastKompletta) traffar = traffar.filter((c) => c.desc);
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
  // Bara bolag med en skriven beskrivning. Registret rymmer tusentals bolag
  // hämtade ur offentliga källor vars kort skulle bli innehållslösa. Kravet
  // gäller beskrivningen och inte visionen: visionen är bolagets egna ord och
  // fylls i av dem själva, medan beskrivningen finns för alla profiler vi
  // arbetat igenom. Används där bolag ställs ut som exempel — aldrig i
  // sökningen, där alla ska kunna hittas.
  endastKompletta = false,
} = {}) {
  const sidnummer = Math.max(1, Number(sida) || 1);
  const sidstorlek = Math.min(100, Math.max(1, Number(antal) || SIDSTORLEK));
  const reserv = () =>
    franStatiskFil({ omrade, tjanst, ort, sida: sidnummer, antal: sidstorlek, endastKompletta });

  try {
    const supabase = createPublicClient();

    if (await tabellenArTom(supabase)) return reserv();

    const fran = (sidnummer - 1) * sidstorlek;
    const rensad = rensaOrt(ort);

    const kor = (kolumner) => {
      let fraga = supabase.from("companies").select(kolumner, { count: "exact" });
      if (omrade) fraga = fraga.contains("focus", [omrade]);
      if (tjanst) fraga = fraga.contains("services", [tjanst]);
      if (endastKompletta) fraga = fraga.not("description", "is", null);
      if (rensad) fraga = fraga.or(`city.eq.${rensad},address.ilike.*${rensad}*`);
      return fraga.order("name").range(fran, fran + sidstorlek - 1);
    };

    let { data, error, count } = await kor(valjKolumner());

    // Ett varv per sen kolumn räcker: varje varv stryker en, och listan är kort.
    for (let i = 0; i < SENA_KOLUMNER.length && error && hanteraSaknadKolumn(error); i++) {
      ({ data, error, count } = await kor(valjKolumner()));
    }

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

    const kor = (kolumner) =>
      supabase.from("companies").select(kolumner).eq("id", nummer).maybeSingle();

    let { data, error } = await kor(valjKolumner());

    for (let i = 0; i < SENA_KOLUMNER.length && error && hanteraSaknadKolumn(error); i++) {
      ({ data, error } = await kor(valjKolumner()));
    }

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
