// Hämtning och sållning av branschnyheter. Filen är fri från Supabase och
// Next så att sållningen kan provköras med scripts/provkor-branschnyheter.mjs
// innan en ändring i ordlistorna når startsidan.

// `allt: true` betyder att källan handlar om branschen i sig och inte sållas.
// Övriga källor skriver om arbetsliv brett, så där måste rubriken träffa ÄMNE.
//
// Google Nyheter provades och valdes bort: lokalnotiser om nystartade bolag
// dominerade, och ordet "hyrläkare" drog in en brottsrubrik som aldrig får
// hamna på startsidan. Lägg till en källa först efter en provkörning.
export const KALLOR = [
  { namn: "Kompetensföretagen", url: "https://www.kompetensforetagen.se/feed/", allt: true },
  { namn: "Almega", url: "https://www.almega.se/feed/" },
  { namn: "Arbetsvärlden", url: "https://www.arbetsvarlden.se/feed/" },
  { namn: "Kollega", url: "https://www.kollega.se/rss.xml" },
  { namn: "Chef", url: "https://www.chef.se/feed/" },
  { namn: "Arbetet", url: "https://www.arbetet.se/feed/" },
  { namn: "Vårdfokus", url: "https://www.vardfokus.se/rss/" },
  { namn: "Svenskt Kvalitetsindex", url: "https://nyheter.kvalitetsindex.se/rss/current_news/13889" },
];

// Rubriken måste nämna branschen eller rekrytering som företeelse. Bara
// "rekrytering" räcker inte: "Setra inleder rekrytering av ny vd" handlar om
// ett bolags vd-byte.
const AMNE = [
  /bemanning/i,
  /rekryteringsf[öo]retag/i,
  /rekryteringsbransch/i,
  /rekryteringsprocess/i,
  /rekryteringsbehov/i,
  /rekryteringsl[äa]ge/i,
  /rekrytera(r|)\s+(sv[åa]rt|sv[åa]rare)/i,
  /(ai|robot\w*)\b.{0,30}\brekryter/i,
  /\brekryter\w*.{0,30}\b(ai|robot\w*)\b/i,
  /hyrpersonal/i,
  /hyrl[äa]kare/i,
  /hyrsjuksk[öo]terskor/i,
  /inhyrd/i,
  /konsultregel/i,
  /kompetensbrist/i,
  /kompetensf[öo]rs[öo]rjning/i,
  /arbetskraftsbrist/i,
  /kompetensf[öo]retagen/i,
  /\b(adecco|randstad|manpower|academic work|poolia|lernia|proffice)\b/i,
  // Arbetsmarknaden i stort. Bemanningsnyheter ensamma räcker till någon enstaka
  // rubrik i veckan, och det här är vad en köpare av rekrytering också följer.
  /arbetsmarknad/i,
  /arbetsl[öo]s/i,
  /arbetss[öo]kande/i,
  /jobbs[öo]kande/i,
  /jobbans[öo]kning/i,
  /\bvarsl(ar|ade|as|et)\b|\bvarsel\b/i,
  /\bs[öo]kt \d+ jobb/i,
  /\bnekades (intervju|jobb)/i,
  /\bai\b.{0,30}\bjobb/i,
];

// JavaScripts \b räknar å, ä och ö som ordgränser, så "\båtal" hittar aldrig
// "åtal" efter ett mellanslag. Därav lookaround på bokstäver.
const ord = (monster) => new RegExp(`(?<!\\p{L})(?:${monster})(?!\\p{L})`, "iu");

// Trumfar ÄMNE och gäller även källor med `allt`. Nyheter om brott och olyckor
// ska inte stå på startsidan även om de råkar nämna hyrpersonal. Nystartade
// lokala bolag och föreningars personalbesked säger inget till en köpare.
const BLOCK = [
  ord("mord|dråp|våldtäkt|barnvåldtäkt|sexuell\\p{L}*|misshandel|åtal\\p{L}*|dömd\\p{L}*|döms|frias|polis\\p{L}*|dog|död\\p{L}*|olyck\\p{L}*"),
  ord("startar nytt?"),
  ord("nytt? (bolag|företag|bemanningsföretag)"),
  ord("ny (ledamot )?i styrelsen"),
  ord("ny \\p{L}*ansvarig"),
];

const ENTITETER = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "" };

function avkoda(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (hel, namn) => ENTITETER[namn] ?? hel)
    .replace(/­/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function falt(item, namn) {
  const m = item.match(new RegExp(`<${namn}(?:\\s[^>]*)?>([\\s\\S]*?)</${namn}>`, "i"));
  return m ? avkoda(m[1]) : "";
}

// Bara de tre fält som behövs, ur RSS 2.0. Rader som saknar något av dem
// eller har ett oläsligt datum hoppas över: ett påhittat datum skulle
// sortera nyheten fel, och en länk måste vara http(s) för att hamna i en href.
export function lasRss(xml) {
  const rader = [];
  for (const [item] of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const titel = falt(item, "title");
    const url = falt(item, "link");
    const datum = new Date(falt(item, "pubDate"));
    if (!titel || !/^https?:\/\//i.test(url) || Number.isNaN(datum.getTime())) continue;
    rader.push({ titel, url, publicerad_at: datum.toISOString() });
  }
  return rader;
}

export function arRelevant(titel, kalla) {
  if (BLOCK.some((r) => r.test(titel))) return false;
  return Boolean(kalla.allt) || AMNE.some((r) => r.test(titel));
}

export function titelNyckel(titel) {
  return titel.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// En källa som ligger nere får inte fälla de andra. Felet lämnas tillbaka så
// att cron-svaret visar vilket flöde som slutat fungera.
export async function hamtaKalla(kalla) {
  try {
    const svar = await fetch(kalla.url, {
      headers: { "user-agent": "Recruitable/1.0 (+https://recruitable.se)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
    const rader = lasRss(await svar.text());
    if (!rader.length) throw new Error("inga läsbara nyheter i flödet");
    return { rader, fel: null };
  } catch (err) {
    return { rader: [], fel: `${kalla.namn}: ${err.message}` };
  }
}

// Alla källor, sållade och utan dubbletter inom körningen.
export async function hamtaBranschnyheter(kallor = KALLOR) {
  const resultat = await Promise.all(kallor.map(hamtaKalla));
  const perNyckel = new Map();
  const problem = [];
  let lasta = 0;

  resultat.forEach(({ rader, fel }, i) => {
    if (fel) problem.push(fel);
    lasta += rader.length;
    for (const rad of rader) {
      if (!arRelevant(rad.titel, kallor[i])) continue;
      const titel_nyckel = titelNyckel(rad.titel);
      if (!perNyckel.has(titel_nyckel)) perNyckel.set(titel_nyckel, { ...rad, titel_nyckel, kalla: kallor[i].namn });
    }
  });

  return { nyheter: [...perNyckel.values()], lasta, problem };
}
