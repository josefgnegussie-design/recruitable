#!/usr/bin/env node
// Bygger ett ifyllnadsunderlag för de största bolagen i registret som saknar
// skriven profil (vision, beskrivning, yrkesområden, tjänster).
//
// Registret ligger i databasen men består av två kända källor: de handkurerade
// bolagen i lib/companies.js och importfilen scripts/data/import-granskning.csv.
// Skriptet läser båda, rangordnar på omsättning och plockar ut de bolag som
// ligger bland de N största utan att ha en vision.
//
// Ut kommer en arbetsbok med en rad per bolag och tomma kolumner att fylla i,
// plus referensblad med de tillåtna yrkesområdena och tjänsterna. Kolumnen id
// är nyckeln som läses tillbaka — den ska inte ändras.
//
// Körs: node scripts/bygg-profilunderlag.mjs [antal]

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require(process.env.XLSX_PATH || "xlsx");

const STATISKA = new URL("../lib/companies.js", import.meta.url);
const IMPORT_CSV = new URL("./data/import-granskning.csv", import.meta.url);
const UT_XLSX = new URL("./data/profilunderlag.xlsx", import.meta.url);
const UT_CSV = new URL("./data/profilunderlag.csv", import.meta.url);

const TOPP = Number(process.argv[2]) || 100;

// Samma listor som filtren i lib/taxonomy.js. Fritext här skulle ge kategorier
// som inget filter kan hitta.
const YRKESOMRADEN = [
  "Administration, ekonomi, juridik", "Bygg och anläggning", "Chefer och verksamhetsledare",
  "Data/IT", "Försäljning, inköp, marknadsföring", "Hantverk", "Hotell, restaurang, storhushåll",
  "Hälso- och sjukvård", "Industriell tillverkning", "Installation, drift, underhåll",
  "Kropps- och skönhetsvård", "Kultur, media, design", "Militära yrken", "Naturbruk",
  "Naturvetenskap", "Pedagogik", "Sanering och renhållning", "Säkerhet och bevakning",
  "Transport, distribution, lager", "Yrken med social inriktning", "Yrken med teknisk inriktning",
];
const TJANSTER = ["Bemanning", "Rekrytering", "Interim", "Search"];

// "1 967,1 Mkr" -> 1967.1. Tusenavgränsaren är ett hårt mellanslag från
// toLocaleString("sv-SE"), inte ett vanligt.
function omsattningTillTal(text) {
  const raw = String(text || "").replace(/\(koncern\)/i, "").replace(/Mkr/i, "");
  const rensad = raw.replace(/[\s ]/g, "").replace(",", ".");
  if (!rensad) return null;
  const n = Number(rensad);
  return Number.isFinite(n) ? n : null;
}

function lasCsv(text) {
  const utanBom = text.replace(/^﻿/, "");
  const rader = [];
  let falt = [];
  let varde = "";
  let citat = false;

  for (let i = 0; i < utanBom.length; i++) {
    const c = utanBom[i];
    if (citat) {
      if (c === '"' && utanBom[i + 1] === '"') { varde += '"'; i++; }
      else if (c === '"') citat = false;
      else varde += c;
    } else if (c === '"') citat = true;
    else if (c === ",") { falt.push(varde); varde = ""; }
    else if (c === "\n") { falt.push(varde); rader.push(falt); falt = []; varde = ""; }
    else if (c !== "\r") varde += c;
  }
  if (varde || falt.length) { falt.push(varde); rader.push(falt); }

  const rubriker = rader.shift();
  return rader
    .filter((r) => r.length === rubriker.length)
    .map((r) => Object.fromEntries(rubriker.map((h, i) => [h, r[i]])));
}

async function lasStatiska() {
  const kod = await readFile(STATISKA, "utf-8");
  return new Function(`${kod.replace("export const", "const")}; return COMPANIES;`)();
}

function csvFalt(varde) {
  const text = varde === null || varde === undefined ? "" : String(varde);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const statiska = await lasStatiska();
  const importerade = lasCsv(await readFile(IMPORT_CSV, "utf-8"));

  const register = [
    ...statiska.map((c) => ({
      id: c.id, name: c.name, org_number: "", city: c.city,
      revenue: c.revenue || "", revenue_year: c.revenueYear || "",
      employees: c.employees || "", link: c.link || "",
      vision: String(c.vision || "").trim(),
    })),
    ...importerade.map((r) => ({
      id: Number(r.id), name: r.name, org_number: r.org_number, city: r.city,
      revenue: r.revenue || "", revenue_year: r.revenue_year || "",
      employees: r.employees || "", link: r.link || "",
      vision: "",
    })),
  ];

  const utanOmsattning = register.filter((c) => omsattningTillTal(c.revenue) === null);

  const rangordnade = register
    .filter((c) => omsattningTillTal(c.revenue) !== null)
    .sort((a, b) => omsattningTillTal(b.revenue) - omsattningTillTal(a.revenue));

  const topp = rangordnade.slice(0, TOPP).map((c, i) => ({ ...c, rang: i + 1 }));
  const saknar = topp.filter((c) => !c.vision);

  const rader = saknar.map((c) => ({
    id: c.id,
    rang: c.rang,
    namn: c.name,
    "org.nr": c.org_number,
    ort: c.city,
    omsättning: c.revenue,
    år: c.revenue_year,
    anställda: c.employees,
    hemsida: c.link,
    vision: "",
    beskrivning: "",
    yrkesområden: "",
    tjänster: "",
    källa: "",
  }));

  const gransen = omsattningTillTal(topp.at(-1)?.revenue);
  const anvisning = [
    [`Ifyllnadsunderlag — bolag bland de ${TOPP} största som saknar profil`],
    [],
    ["Fyll i de fyra tomma kolumnerna i bladet Profiler. Rör inte kolumnen id — den är nyckeln vid inläsning."],
    [],
    ["vision", "En mening om vad bolaget vill åstadkomma, hämtad från bolagets egen webbplats (Om oss / Vår vision)."],
    ["beskrivning", "Två till tre meningar: vad bolaget gör, för vilka branscher, var. Beskrivande, inte säljande."],
    ["yrkesområden", "Ett eller flera värden ur bladet Yrkesområden, åtskilda med semikolon. Bara de 21 värdena går att filtrera på."],
    ["tjänster", "Ett eller flera av Bemanning, Rekrytering, Interim, Search — åtskilda med semikolon."],
    ["källa", "Adressen texten bygger på, så att en uppgift går att kontrollera i efterhand."],
    [],
    ["Lämna hellre ett fält tomt än att gissa. Ett tomt fält säger \"vi vet inte\"; ett felaktigt säger något osant om någon annans bolag."],
    ["Bolaget kan senare ta över profilen och skriva om texten själv — det här är utgångsläget, inte sista ordet."],
    [],
    ["Om rangordningen"],
    ["Grund", "Omsättning ur samma underlag som registret."],
    ["Gräns", `${gransen} Mkr är lägsta omsättning bland de ${TOPP} största.`],
    ["Utanför", `${utanOmsattning.length} bolag i registret saknar omsättningsuppgift och kan inte rangordnas alls.`],
  ];

  const wb = XLSX.utils.book_new();

  const wsProfiler = XLSX.utils.json_to_sheet(rader);
  wsProfiler["!cols"] = [
    { wch: 6 }, { wch: 6 }, { wch: 34 }, { wch: 13 }, { wch: 14 }, { wch: 12 },
    { wch: 6 }, { wch: 10 }, { wch: 34 }, { wch: 60 }, { wch: 70 }, { wch: 34 },
    { wch: 26 }, { wch: 34 },
  ];
  wsProfiler["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 13, r: rader.length } }) };
  wsProfiler["!freeze"] = "A2";
  XLSX.utils.book_append_sheet(wb, wsProfiler, "Profiler");

  const wsAnvisning = XLSX.utils.aoa_to_sheet(anvisning);
  wsAnvisning["!cols"] = [{ wch: 22 }, { wch: 105 }];
  XLSX.utils.book_append_sheet(wb, wsAnvisning, "Så fyller du i");

  const wsYrken = XLSX.utils.aoa_to_sheet([["Yrkesområde"], ...YRKESOMRADEN.map((y) => [y])]);
  wsYrken["!cols"] = [{ wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsYrken, "Yrkesområden");

  const wsTjanster = XLSX.utils.aoa_to_sheet([["Tjänst"], ...TJANSTER.map((t) => [t])]);
  wsTjanster["!cols"] = [{ wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTjanster, "Tjänster");

  XLSX.writeFile(wb, new URL(UT_XLSX).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

  const rubriker = Object.keys(rader[0]);
  const csv = [rubriker.join(","), ...rader.map((r) => rubriker.map((k) => csvFalt(r[k])).join(","))].join("\n");
  await writeFile(UT_CSV, `﻿${csv}`, "utf-8");

  console.log(`Registret: ${register.length} bolag (${statiska.length} handkurerade + ${importerade.length} importerade).`);
  console.log(`  ${register.filter((c) => c.vision).length} har en skriven profil`);
  console.log(`  ${utanOmsattning.length} saknar omsättning och rangordnas inte`);
  console.log(`\nBland de ${TOPP} största: ${topp.length - saknar.length} har profil, ${saknar.length} saknar.`);
  console.log(`Omsättning i urvalet: ${omsattningTillTal(saknar[0]?.revenue)}–${omsattningTillTal(saknar.at(-1)?.revenue)} Mkr.`);
  console.log(`  ${rader.filter((r) => r.hemsida).length} av ${rader.length} har hemsida att läsa profilen ur`);
  console.log(`\nSparat till scripts/data/profilunderlag.xlsx och .csv`);
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
