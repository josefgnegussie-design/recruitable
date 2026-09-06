#!/usr/bin/env node
// Härleder yrkesområden och tjänster ur Bolagsverkets verksamhetsbeskrivningar.
//
// Mönstren körs mot bolagsordningens text, inte mot bolagsnamnet. Skillnaden är
// stor: namnet gav 2,3 procents täckning, medan beskrivningen ofta säger rakt ut
// vad bolaget gör — "bedriva rekrytering och uthyrning av personal inom vård och
// omsorg".
//
// Utan --skriv görs ingenting mot databasen. Körningen mäter i stället sig själv
// mot de 57 bolag som klassificerats för hand, så att träffsäkerheten är känd
// innan något publiceras.
//
// Körs:
//   node --env-file=.env.local scripts/klassificera-verksamhet.mjs          (mät)
//   node --env-file=.env.local scripts/klassificera-verksamhet.mjs --skriv  (skriv)

import { readFile, writeFile } from "node:fs/promises";

const BESKRIVNINGAR = new URL("./data/verksamhetsbeskrivningar.json", import.meta.url);
const FACIT = new URL("./data/toppbolag-klassificering.json", import.meta.url);
const UT = new URL("./data/klassificering-forslag.json", import.meta.url);

// Branschordet räknas bara när det står som föremål för verksamheten: efter
// "inom", eller direkt sammanbundet med bemanning, rekrytering, uthyrning eller
// konsultverksamhet. Utan den inramningen fastnade sidoverksamheter — Flexcare
// klassades som marknadsföring för att bolagsordningen råkar nämna det bland
// konsulttjänsterna, trots att de bemannar vården.
//
// Ordgränser är inte valfria. \bIT\b utan gränser matchar bokstäverna "it"
// inuti vilket ord som helst och gav felaktiga IT-träffar.
//
// Mätt mot 57 handklassificerade bolag: 93 procent av gissningarna rätt,
// hälften av de rätta hittade. Ord som "utbildning", "teknik" och "service" är
// uteslutna — de står i nästan varje bolagsordning utan att säga något.
const BRANSCHORD = [
  ["Hälso- och sjukvård", "vård|sjukvård|omsorg|läkar|sjukskötersk|tandvård"],
  ["Data/IT", "\\bIT\\b|mjukvar|systemutveckl|programmering|utvecklare"],
  ["Bygg och anläggning", "bygg|anläggning|bergarbete|bergteknik"],
  ["Industriell tillverkning", "industri|verkstad|produktionsbemanning"],
  ["Transport, distribution, lager", "logistik|\\blager\\b|transport|åkeri|sjöfart|shipping|luftfart|tågbransch|offshore"],
  ["Administration, ekonomi, juridik", "ekonomi|redovisning|\\blön\\b|finans|\\bHR\\b"],
  ["Chefer och verksamhetsledare", "företagsledande|ledande befattning|executive"],
  ["Yrken med teknisk inriktning", "ingenjör|tekniska konsulter|teknisk konsultverksamhet"],
  ["Försäljning, inköp, marknadsföring", "inköp|supply chain|detaljhandel"],
  ["Yrken med social inriktning", "socialt arbete|socionom|\\bHVB\\b|socialtjänst"],
  ["Pedagogik", "förskol|skola|lärar|pedagog"],
  ["Hotell, restaurang, storhushåll", "restaurang|hotell|storhushåll"],
  ["Sanering och renhållning", "lokalvård|städ|sanering"],
  ["Naturbruk", "lantbruk|skogsbruk|trädgård"],
  ["Säkerhet och bevakning", "bevakning|väktare"],
  ["Kultur, media, design", "\\bmedia\\b|mediebransch"],
];

const YRKE = BRANSCHORD.map(([omrade, ord]) => [
  omrade,
  new RegExp(`(inom[^.]{0,40}(${ord})|(${ord})[a-zåäö]*(bemanning|rekryter|uthyrning|konsult|personal))`, "i"),
]);

const TJANST = [
  ["Bemanning", /bemanning|personaluthyrning|uthyrning av personal|uthyrning av konsulter|uthyrning av arbetskraft|tillhandahållande av personal|hyra ut/i],
  ["Rekrytering", /rekryter|arbetsförmedling|personalanskaffning|urval av personal/i],
  ["Interim", /\binterim/i],
  ["Search", /executive search|search-verksamhet/i],
];

function klassificera(text) {
  if (!text) return { yrken: [], tjanster: [] };
  return {
    yrken: YRKE.filter(([, re]) => re.test(text)).map(([o]) => o),
    tjanster: TJANST.filter(([, re]) => re.test(text)).map(([t]) => t),
  };
}

function jamfor(facit, forslag) {
  const f = new Set(facit);
  const p = new Set(forslag);
  return {
    ratt: [...p].filter((x) => f.has(x)).length,
    falska: [...p].filter((x) => !f.has(x)).length,
    missade: [...f].filter((x) => !p.has(x)).length,
  };
}

async function main() {
  const { bolag: beskrivningar } = JSON.parse(await readFile(BESKRIVNINGAR, "utf-8"));
  const { bolag: facit } = JSON.parse(await readFile(FACIT, "utf-8"));

  // Mät mot handklassificeringen innan något skrivs.
  const summa = { yrke: { ratt: 0, falska: 0, missade: 0 }, tjanst: { ratt: 0, falska: 0, missade: 0 } };
  const avvikelser = [];

  for (const [id, sant] of Object.entries(facit)) {
    const text = beskrivningar[id]?.beskrivning;
    const gissning = klassificera(text);

    const y = jamfor(sant.focus || [], gissning.yrken);
    const t = jamfor(sant.services || [], gissning.tjanster);
    for (const k of ["ratt", "falska", "missade"]) {
      summa.yrke[k] += y[k];
      summa.tjanst[k] += t[k];
    }

    if (y.falska || y.missade) {
      avvikelser.push({
        namn: beskrivningar[id]?.namn || id,
        facit: sant.focus,
        gissning: gissning.yrken,
      });
    }
  }

  const precision = (s) => (s.ratt + s.falska ? ((100 * s.ratt) / (s.ratt + s.falska)).toFixed(0) : "–");
  const tackning = (s) => (s.ratt + s.missade ? ((100 * s.ratt) / (s.ratt + s.missade)).toFixed(0) : "–");

  console.log("Mätning mot 57 handklassificerade bolag:");
  console.log(`  yrkesområde  ${precision(summa.yrke)} % av gissningarna rätt, ${tackning(summa.yrke)} % av de rätta hittade`);
  console.log(`  tjänst       ${precision(summa.tjanst)} % av gissningarna rätt, ${tackning(summa.tjanst)} % av de rätta hittade`);

  console.log(`\n${avvikelser.length} bolag där yrkesområdet avviker:`);
  for (const a of avvikelser.slice(0, 12)) {
    console.log(`  ${a.namn.slice(0, 32).padEnd(34)}`);
    console.log(`     jag: ${a.facit.join(", ") || "(inget)"}`);
    console.log(`     mönster: ${a.gissning.join(", ") || "(inget)"}`);
  }

  // Förslag för hela registret.
  const forslag = {};
  let medYrke = 0;
  let medTjanst = 0;

  for (const [id, post] of Object.entries(beskrivningar)) {
    const g = klassificera(post.beskrivning);
    if (!g.yrken.length && !g.tjanster.length) continue;
    forslag[id] = { namn: post.namn, focus: g.yrken, services: g.tjanster };
    if (g.yrken.length) medYrke++;
    if (g.tjanster.length) medTjanst++;
  }

  await writeFile(UT, JSON.stringify({ skapad: new Date().toISOString(), bolag: forslag }, null, 1), "utf-8");

  const totalt = Object.keys(beskrivningar).length;
  console.log(`\nHela registret (${totalt} bolag):`);
  console.log(`  ${medYrke} får yrkesområde (${((100 * medYrke) / totalt).toFixed(0)} %)`);
  console.log(`  ${medTjanst} får tjänst (${((100 * medTjanst) / totalt).toFixed(0)} %)`);
  console.log("\nSparat till scripts/data/klassificering-forslag.json");

  if (!process.argv.includes("--skriv")) {
    console.log("Ingenting skrivet till databasen. Lägg till --skriv när siffrorna duger.");
  }
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
