// Pågående upphandlingar som teaser på /upphandling: att det faktiskt händer
// något här. ENDAST SERVERSIDAN — läser inquiries med service role.
//
// Varje kort byggs ur fasta val och korta uppgifter: orter, volym, kompetenser,
// yrkesområden, antal arbetsställen och tidplan. Köparens namn, rubrik,
// beskrivning, "Beskriv er verksamhet" och gatuadresser används aldrig: namnet
// är just det som ska locka bolagen att tacka ja.
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

const MANADER = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const TAL = ["", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];

// En typisk yrkesprofil per yrkesområde, när köparen inte angett kompetenser.
const PROFIL = {
  "Industri och tillverkning": "montör",
  "Lager, logistik och transport": "lagerarbetare",
  IT: "IT-konsult",
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

// Yrkesområdena som de låter efter "inom": "lager och logistik".
const OMRADE_KORT = {
  "Industri och tillverkning": "industri",
  "Lager, logistik och transport": "lager och logistik",
  IT: "IT",
  "Administration och kontor": "administration",
  "Ekonomi och finans": "ekonomi",
  "Teknik och ingenjörer": "teknik",
  "Försäljning och kundtjänst": "försäljning och kundtjänst",
  "Hälso- och sjukvård": "vård",
  "Omsorg och socialt arbete": "omsorg",
  "Bygg och anläggning": "bygg",
  "El, installation och underhåll": "el och underhåll",
  "Hotell, restaurang och storkök": "restaurang",
  "Skola och förskola": "skola",
  "Handel och butik": "handel",
  "Chefer och ledning": "ledning",
  "HR och personal": "HR",
  Juridik: "juridik",
};

// Högst så många profiler i rubriken, så att korten håller samma rytm.
const MAX_PROFILER = 2;

// "a, b och c".
function lista(ord, bindeord = "och") {
  if (ord.length <= 1) return ord.join("");
  return `${ord.slice(0, -1).join(", ")} ${bindeord} ${ord.at(-1)}`;
}

// "Truckförare" blir "truckförare" mitt i en mening, men "IT-konsult" och
// "HR-specialist" behåller sina versaler.
function gemen(ord) {
  return /^[A-ZÅÄÖ][a-zåäöé]/.test(ord) ? ord[0].toLowerCase() + ord.slice(1) : ord;
}

function versal(ord) {
  return ord ? ord[0].toUpperCase() + ord.slice(1) : ord;
}

// Plural för yrkestitlar: montör → montörer, sjuksköterska → sjuksköterskor,
// kock → kockar. Titlar på -are och -er (truckförare, elektriker) är lika i
// plural. Sammansatta titlar följer sitt sista led.
export function plural(titel) {
  if (/(are|er)$/.test(titel)) return titel;
  if (/a$/.test(titel)) return titel.replace(/a$/, "or");
  if (/ock$/.test(titel)) return `${titel}ar`;
  if (/(ör|ef|om|ist|ent|ekt|ant|at|ult|or|ik)$/.test(titel)) return `${titel}er`;
  return titel;
}

// Första heltalet i köparens volym: "Cirka 40 konsulter samtidigt" → 40,
// "1 200" → 1200.
function antalUrVolym(volym) {
  const m = String(volym || "").replace(/(\d)\s(?=\d{3}\b)/g, "$1").match(/\d+/);
  const n = m ? Number(m[0]) : 0;
  return n > 0 && n < 100000 ? n : null;
}

function profiler(u) {
  const kompetenser = (u.kompetenser ?? []).map((k) => k.trim()).filter(Boolean);
  const kallor = kompetenser.length ? kompetenser : (u.omraden ?? []).map((o) => PROFIL[o]).filter(Boolean);
  return [...new Set(kallor.map(gemen))];
}

// Kortets rubrik: volym och profil, "100 truckförare" eller "40 montörer och
// svetsare". Utan tal i volymen bara profilerna.
export function rubrik(u) {
  const alla = profiler(u);
  if (!alla.length) return "Personal";
  const antal = antalUrVolym(u.volym);
  const visade = alla.slice(0, MAX_PROFILER).map((p) => (antal === 1 ? p : plural(p)));
  const text = alla.length > MAX_PROFILER ? `${visade.join(", ")} m.fl.` : lista(visade);
  return antal ? `${antal.toLocaleString("sv-SE")} ${text}` : versal(text);
}

// Raden ovanför rubriken: orterna, "Göteborg och Borås".
export function orter({ city }, u) {
  return lista(u.orter?.length ? u.orter : [city].filter(Boolean));
}

// Brödtexten: "Företag söker samarbetspartner inom lager och logistik till två
// arbetsställen."
export function sammanfattning(u) {
  const omraden = [...new Set((u.omraden ?? []).map((o) => OMRADE_KORT[o] ?? o.toLowerCase()))];
  // "industri samt lager och logistik": "och" i områdena kräver "samt" mellan dem.
  const binder = omraden.some((o) => o.includes(" och ")) ? "samt" : "och";
  const inom = omraden.length ? ` inom ${lista(omraden, binder)}` : "";
  const antal = u.arbetsstallen?.length ?? 0;
  const platser = antal > 1 ? ` till ${TAL[antal] ?? antal} arbetsställen` : "";
  return `Företag söker samarbetspartner${inom}${platser}.`;
}

function kortDatum(iso) {
  if (!iso) return null;
  // Utan år: stegen ligger inom några månader, och året gör tidslinjen trång.
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MANADER[m - 1]}`;
}

// Upphandlingens fyra steg med datum. Steg ett är när inbjudan skickades, de
// andra tre köparens tidplan: svar senast, besked till bolagen och planerad
// start, som är när upphandlingen avslutas och uppdraget tar vid.
export function tidslinje(skickad, u) {
  return [
    { steg: "Inbjudan", datum: kortDatum(skickad) },
    { steg: "Svar", datum: kortDatum(u.svaraSenast) },
    { steg: "Besked", datum: kortDatum(u.beskedSenast) },
    { steg: "Avslut", datum: kortDatum(u.startdatum) },
  ];
}

function kort(r, u, exempel) {
  return {
    orter: orter(r, u),
    rubrik: rubrik(u),
    mening: sammanfattning(u),
    tidslinje: tidslinje(r.created_at, u),
    exempel,
    nyckel: orter(r, u),
  };
}

// Datum ett antal dagar från i dag, så att exemplen aldrig ligger i det
// förflutna.
function omDagar(n) {
  return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
}

// Visas bara när det finns för få riktiga, och är märkta "Exempel" på sidan.
function exempel() {
  return [
    {
      service: "Bemanning",
      created_at: omDagar(-4),
      u: {
        orter: ["Göteborg", "Borås"],
        omraden: ["Lager, logistik och transport"],
        kompetenser: ["Truckförare"],
        volym: "Cirka 100 konsulter",
        arbetsstallen: [{}, {}],
        svaraSenast: omDagar(10),
        beskedSenast: omDagar(24),
        startdatum: omDagar(60),
      },
    },
    {
      service: "Konsultuppdrag",
      created_at: omDagar(-2),
      u: {
        orter: ["Stockholm"],
        omraden: ["IT"],
        kompetenser: ["Systemutvecklare"],
        volym: "15 konsulter",
        svaraSenast: omDagar(12),
        beskedSenast: omDagar(30),
        startdatum: omDagar(75),
      },
    },
    {
      service: "Bemanning",
      created_at: omDagar(-6),
      u: {
        orter: ["Malmö", "Helsingborg"],
        omraden: ["Hälso- och sjukvård"],
        kompetenser: ["Sjuksköterska"],
        volym: "30",
        arbetsstallen: [{}, {}],
        svaraSenast: omDagar(8),
        beskedSenast: omDagar(21),
        startdatum: omDagar(45),
      },
    },
    {
      service: "Bemanning",
      created_at: omDagar(-1),
      u: {
        orter: ["Linköping"],
        omraden: ["Industri och tillverkning"],
        kompetenser: ["Montör", "Svetsare"],
        volym: "40 personer",
        svaraSenast: omDagar(14),
        beskedSenast: omDagar(28),
        startdatum: omDagar(70),
      },
    },
  ].map(({ u, ...r }) => kort(r, u, true));
}

export async function hamtaPagaendeUpphandlingar() {
  const riktiga = await hamtaRiktiga();
  if (riktiga.length >= MIN_MED_EXEMPEL) return riktiga.map(({ nyckel, ...k }) => k);
  // Ett exempel på samma orter som en riktig upphandling visas inte bredvid den.
  const egna = new Set(riktiga.map((r) => r.nyckel));
  return [...riktiga, ...exempel().filter((e) => !egna.has(e.nyckel))]
    .slice(0, Math.max(riktiga.length, MIN_MED_EXEMPEL + 1))
    .map(({ nyckel, ...k }) => k);
}

async function hamtaRiktiga() {
  try {
    const sedan = new Date(Date.now() - DAGAR * 864e5).toISOString();
    const { data, error } = await createAdminClient()
      .from("inquiries")
      .select("id, created_at, service, city, upphandling")
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
      .map((r) => kort(r, r.upphandling, false));
  } catch (err) {
    // Saknas kolumnen eller nätet: bara exemplen.
    console.error("Kunde inte läsa pågående upphandlingar:", err.message);
    return [];
  }
}
