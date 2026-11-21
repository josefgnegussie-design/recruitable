// Pågående upphandlingar som teaser på /upphandling: att det faktiskt händer
// något här. ENDAST SERVERSIDAN — läser inquiries med service role.
//
// Varje upphandling blir en mening byggd enbart ur fasta val: tjänst,
// yrkesområden, orter, tidplan och hur många bolag som bjudits in. Köparens egna
// fritexter (rubrik, beskrivning, "Beskriv er verksamhet") används aldrig: de kan
// avslöja köparen, och det är just namnet som ska locka bolagen att tacka ja.
// Orten (arbetsställenas kommuner) står som rubrik på kortet, inte gatuadressen.
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

// Yrkesområdena som de låter i en mening: vilka människor köparen behöver.
const ROLLER = {
  "Industri och tillverkning": "operatörer och montörer till industrin",
  "Lager, logistik och transport": "personal till lager och logistik",
  IT: "utvecklare och andra IT-specialister",
  "Administration och kontor": "administratörer och kontorspersonal",
  "Ekonomi och finans": "ekonomer och redovisningskonsulter",
  "Teknik och ingenjörer": "ingenjörer och tekniker",
  "Försäljning och kundtjänst": "säljare och kundtjänstpersonal",
  "Hälso- och sjukvård": "sjuksköterskor och annan vårdpersonal",
  "Omsorg och socialt arbete": "personal till omsorg och socialt arbete",
  "Bygg och anläggning": "yrkesarbetare till bygg och anläggning",
  "El, installation och underhåll": "elektriker och underhållstekniker",
  "Hotell, restaurang och storkök": "kockar och restaurangpersonal",
  "Skola och förskola": "lärare och förskolepersonal",
  "Handel och butik": "butikspersonal",
  "Chefer och ledning": "chefer",
  "HR och personal": "HR-specialister",
  Juridik: "jurister",
};

// Varje tjänst som en mening. `vem` är "Ett företag i Skåne" eller liknande.
const TJANST_MENING = {
  Bemanning: (vem, roller) => `${vem} söker en bemanningspartner för ${roller}`,
  Konsultuppdrag: (vem, roller) => `${vem} behöver ${roller} på konsultbasis`,
  Rekrytering: (vem, roller) => `${vem} söker en rekryteringspartner för att anställa ${roller}`,
  "Hyr/Rekrytering": (vem, roller) => `${vem} vill hyra in ${roller} med möjlighet till anställning`,
  Interim: (vem, roller) => `${vem} söker ${roller} på interimsbasis`,
  Search: (vem, roller) => `${vem} vill hitta ${roller} genom search`,
};

// Kortets rubrik: orterna där arbetet utförs, "Göteborg och Borås".
export function rubrik({ city }, u) {
  return lista(u.orter?.length ? u.orter : [city].filter(Boolean)) || "Sverige";
}

// "a, b och c". Rollerna har själva "och" i sig ("operatörer och montörer"),
// så flera binds ihop med "samt" för att meningen ska gå att läsa.
function lista(ord, bindeord = "och") {
  if (ord.length <= 1) return ord.join("");
  return `${ord.slice(0, -1).join(", ")} ${bindeord} ${ord.at(-1)}`;
}

function manad(iso) {
  const [ar, m] = iso.split("-").map(Number);
  const iAr = new Date().getFullYear() === ar;
  return iAr ? MANADER[m - 1] : `${MANADER[m - 1]} ${ar}`;
}

// Upphandlingen i en eller två meningar, till exempel "Ett företag söker en bemanningspartner för operatörer och montörer till
// industrin samt personal till lager och logistik, på två arbetsställen.
// Uppdraget börjar i januari 2027."
export function sammanfattning({ service }, u) {
  const vem = "Ett företag";
  const roller = lista(
    (u.omraden ?? []).map((o) => ROLLER[o] ?? o.toLowerCase()),
    "samt"
  ) || "personal";
  const mening = (TJANST_MENING[service] ?? TJANST_MENING.Bemanning)(vem, roller);
  const antal = u.arbetsstallen?.length ?? 0;
  const platser = antal > 1 ? `, på ${TAL[antal] ?? antal} arbetsställen` : "";
  const start = u.startdatum ? ` Uppdraget börjar i ${manad(u.startdatum)}.` : "";
  return `${mening}${platser}.${start}`;
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
      u: { orter: ["Stockholm"], omraden: ["IT", "Teknik och ingenjörer"], startdatum: omManader(4) },
    },
    {
      service: "Hyr/Rekrytering",
      u: { orter: ["Malmö", "Helsingborg"], omraden: ["Hälso- och sjukvård"], arbetsstallen: [{}, {}], startdatum: omManader(2) },
    },
    {
      service: "Konsultuppdrag",
      u: { orter: ["Linköping"], omraden: ["Ekonomi och finans"], startdatum: omManader(2) },
    },
    {
      service: "Bemanning",
      u: {
        orter: ["Göteborg", "Borås"],
        omraden: ["Industri och tillverkning", "Lager, logistik och transport"],
        arbetsstallen: [{}, {}],
        startdatum: omManader(3),
      },
    },
  ].map(({ service, u }) => ({
    rubrik: rubrik({}, u),
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
        rubrik: rubrik(r, r.upphandling),
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
