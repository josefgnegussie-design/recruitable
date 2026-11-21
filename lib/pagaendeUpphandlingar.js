// Pågående upphandlingar som teaser på /upphandling: att det faktiskt händer
// något här. ENDAST SERVERSIDAN — läser inquiries med service role.
//
// Varje upphandling blir en mening byggd enbart ur fasta val: tjänst,
// yrkesområden, kompetenser, orter, tidplan och hur många bolag som bjudits in. Köparens egna
// fritexter (rubrik, beskrivning, "Beskriv er verksamhet") används aldrig: de kan
// avslöja köparen, och det är just namnet som ska locka bolagen att tacka ja.
// Rubriken är yrkesprofilerna och raden under orterna (arbetsställenas
// kommuner), aldrig gatuadressen.
//
// Bara inbjudningar där köparen sagt ja till att visas (visaSomExempel), som
// Recruitable godkänt och vars svarsdatum inte passerat.

import { idag } from "@/lib/upphandling";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX = 6;
// Under så här många riktiga upphandlingar fylls listan på med exempel, så att
// besökaren förstår vad avsnittet är. Exemplen är märkta som exempel.
const MIN_MED_EXEMPEL = 3;
const DAGAR = 90;

const MANADER = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

const TAL = ["", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];

// En typisk yrkesprofil per yrkesområde, för rubriken när köparen inte angett
// några kompetenser.
const PROFIL = {
  "Industri och tillverkning": "montör",
  "Lager, logistik och transport": "lagerarbetare",
  IT: "IT",
  "Administration och kontor": "administratör",
  "Ekonomi och finans": "ekonom",
  "Teknik och ingenjörer": "ingenjör",
  "Försäljning och kundtjänst": "säljare",
  "Hälso- och sjukvård": "sjuksköterska",
  "Omsorg och socialt arbete": "undersköterska",
  "Bygg och anläggning": "byggarbetare",
  "El, installation och underhåll": "elektriker",
  "Hotell, restaurang och storkök": "kock",
  "Skola och förskola": "lärare",
  "Handel och butik": "butikssäljare",
  "Chefer och ledning": "chef",
  "HR och personal": "HR-specialist",
  Juridik: "jurist",
};

// Högst så många profiler i rubriken, så att korten håller samma rytm.
const MAX_PROFILER = 3;

// Vad köparen söker, som en kort fras utan subjekt: "söker en bemanningspartner".
const TJANST_FRAS = {
  Bemanning: "söker en bemanningspartner",
  Konsultuppdrag: "söker en konsultpartner",
  Rekrytering: "söker en rekryteringspartner",
  "Hyr/Rekrytering": "söker en partner för hyrrekrytering",
  Interim: "söker en interimspartner",
  Search: "söker en searchpartner",
};

// "a, b och c".
function lista(ord) {
  if (ord.length <= 1) return ord.join("");
  return `${ord.slice(0, -1).join(", ")} och ${ord.at(-1)}`;
}

// "Truckförare" blir "truckförare" mitt i en lista, men "IT" och "HR-specialist"
// behåller sina versaler.
function gemen(ord) {
  return /^[A-ZÅÄÖ][a-zåäöé]/.test(ord) ? ord[0].toLowerCase() + ord.slice(1) : ord;
}

function versal(ord) {
  return ord ? ord[0].toUpperCase() + ord.slice(1) : ord;
}

function manad(iso) {
  const [ar, m] = iso.split("-").map(Number);
  const iAr = new Date().getFullYear() === ar;
  return iAr ? MANADER[m - 1] : `${MANADER[m - 1]} ${ar}`;
}

// Kortets rubrik: yrkesprofilerna, "Montör, truckförare och IT". Köparens
// kompetenser i första hand, annars en typisk profil per yrkesområde.
export function rubrik(u) {
  const kompetenser = (u.kompetenser ?? []).map((k) => k.trim()).filter(Boolean);
  const kallor = kompetenser.length ? kompetenser : (u.omraden ?? []).map((o) => PROFIL[o]).filter(Boolean);
  const profiler = [...new Set(kallor.map(gemen))];
  if (!profiler.length) return "Personal";
  const visade = profiler.slice(0, MAX_PROFILER);
  const text = profiler.length > MAX_PROFILER ? `${visade.join(", ")} m.fl.` : lista(visade);
  return versal(text);
}

// Raden under rubriken: orterna där arbetet utförs, "Göteborg och Borås".
export function orter({ city }, u) {
  return lista(u.orter?.length ? u.orter : [city].filter(Boolean));
}

// Brödtexten, kort och i samma form på alla kort: "Ett företag söker en
// bemanningspartner till två arbetsställen. Start i januari 2027."
export function sammanfattning({ service }, u) {
  const antal = u.arbetsstallen?.length ?? 0;
  const platser = antal > 1 ? ` till ${TAL[antal] ?? antal} arbetsställen` : "";
  const start = u.startdatum ? ` Start i ${manad(u.startdatum)}.` : "";
  return `Ett företag ${TJANST_FRAS[service] ?? TJANST_FRAS.Bemanning}${platser}.${start}`;
}

// Ett exempel som liknar en riktig upphandling (samma tjänst och områden)
// visas inte bredvid den.
function nyckelFor(service, u) {
  return `${service}|${[...(u.omraden ?? [])].sort().join(",")}`;
}

// Datum ett antal månader fram, så att exemplen aldrig ligger i det förflutna.
function omManader(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Visas bara när det finns för få riktiga, och är märkta "Exempel" på sidan.
function exempel() {
  return [
    {
      service: "Rekrytering",
      u: {
        orter: ["Stockholm"],
        omraden: ["IT", "Teknik och ingenjörer"],
        kompetenser: ["Systemutvecklare", "IT-arkitekt"],
        startdatum: omManader(4),
      },
    },
    {
      service: "Hyr/Rekrytering",
      u: {
        orter: ["Malmö", "Helsingborg"],
        omraden: ["Hälso- och sjukvård"],
        kompetenser: ["Sjuksköterska", "Undersköterska"],
        arbetsstallen: [{}, {}],
        startdatum: omManader(2),
      },
    },
    {
      service: "Konsultuppdrag",
      u: { orter: ["Linköping"], omraden: ["Ekonomi och finans"], kompetenser: ["Redovisningsekonom"], startdatum: omManader(2) },
    },
    {
      service: "Bemanning",
      u: {
        orter: ["Göteborg", "Borås"],
        omraden: ["Industri och tillverkning", "Lager, logistik och transport"],
        kompetenser: ["Montör", "Truckförare", "Lagerarbetare"],
        arbetsstallen: [{}, {}],
        startdatum: omManader(3),
      },
    },
  ].map(({ service, u }) => ({
    rubrik: rubrik(u),
    orter: orter({}, u),
    mening: sammanfattning({ service }, u),
    inbjudna: 0,
    svaraSenast: null,
    exempel: true,
    nyckel: nyckelFor(service, u),
  }));
}

export async function hamtaPagaendeUpphandlingar() {
  const riktiga = await hamtaRiktiga();
  if (riktiga.length >= MIN_MED_EXEMPEL) return riktiga;
  const egna = new Set(riktiga.map((r) => r.nyckel));
  return [...riktiga, ...exempel().filter((e) => !egna.has(e.nyckel))]
    .slice(0, Math.max(riktiga.length, MIN_MED_EXEMPEL + 1))
    .map(({ nyckel, ...u }) => u);
}

async function hamtaRiktiga() {
  try {
    const sedan = new Date(Date.now() - DAGAR * 864e5).toISOString();
    const { data, error } = await createAdminClient()
      .from("inquiries")
      .select("id, created_at, service, city, upphandling, inquiry_recipients(count)")
      .eq("moderation_status", "approved")
      .not("upphandling", "is", null)
      .gte("created_at", sedan)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;

    const dag = idag();
    return (data ?? [])
      .filter((r) => r.upphandling?.visaSomExempel === true)
      .filter((r) => !r.upphandling.svaraSenast || r.upphandling.svaraSenast >= dag)
      .slice(0, MAX)
      .map((r) => ({
        rubrik: rubrik(r.upphandling),
        orter: orter(r, r.upphandling),
        mening: sammanfattning(r, r.upphandling),
        inbjudna: r.inquiry_recipients?.[0]?.count ?? 0,
        svaraSenast: r.upphandling.svaraSenast ?? null,
        exempel: false,
        nyckel: nyckelFor(r.service, r.upphandling),
      }));
  } catch (err) {
    // Saknas kolumnen eller nätet: bara exemplen.
    console.error("Kunde inte läsa pågående upphandlingar:", err.message);
    return [];
  }
}
