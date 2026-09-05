#!/usr/bin/env node
// Bygger en granskningsfil (CSV) av bolagen i scripts/data/allabolag_500000.xlsx,
// redo att importeras till companies-tabellen.
//
// Yrkesområden sätts bara där bolagsnamnet är otvetydigt. En bred ordlista gav
// 17 % täckning men också självsäkra fel — "Frilans Finans" klassades som
// ekonomirekrytering på ordet "finans", trots att det är ett egenanställnings-
// företag för frilansare i alla branscher. Ett felaktigt yrkesområde är sämre än
// inget: ett tomt fält säger "vi vet inte", ett felaktigt säger något osant om
// någon annans bolag. Därför bara sammansättningar som pekar ut en bransch och
// inget annat.
//
// Körs: node scripts/bygg-import-fran-excel.mjs

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require(process.env.XLSX_PATH || "xlsx");

const EXCEL = new URL("./data/allabolag_500000.xlsx", import.meta.url);
const STATISKA = new URL("../lib/companies.js", import.meta.url);
const UT_CSV = new URL("./data/import-granskning.csv", import.meta.url);

const FORSTA_ID = 60;

// Varje mönster måste peka ut en bransch och ingenting annat. Ord som "data",
// "finans", "tech" och "care" är medvetet uteslutna — de förekommer i namn som
// inte har med branschen att göra.
const YRKESMONSTER = [
  ["Hälso- och sjukvård", /läkar|lakar|sjuksköt|sjukskot|vårdbemanning|vardbemanning|vårdpersonal|tandläkar|tandlakar|omsorgsbemanning|hemtjänst|hemtjanst|psykolog/i],
  ["Transport, distribution, lager", /lager\s*&|logistikbemanning|åkeri|akeri|chaufför|chauffor|truckförar|truckforar|distributionsbemanning|transportbemanning/i],
  ["Bygg och anläggning", /byggbemanning|byggrekryter|construction|anläggningsbemanning|anlaggningsbemanning|byggkompetens/i],
  ["Industriell tillverkning", /industribemanning|industrirekryter|produktionsbemanning|svetsbemanning|verkstadsbemanning/i],
  ["Data/IT", /it-bemanning|it-rekryter|it-konsult|utvecklarbemanning|developers|mjukvarukonsult/i],
  ["Chefer och verksamhetsledare", /interim executive|chefsrekryter|executive search|ledarrekryter/i],
  ["Hotell, restaurang, storhushåll", /restaurangbemanning|hotellbemanning|kockbemanning|krogbemanning/i],
  ["Pedagogik", /lärarbemanning|lararbemanning|skolbemanning|förskolebemanning|forskolebemanning|lärarvikar|lararvikar/i],
  ["Yrken med social inriktning", /socionombemanning|socialtjänstbemanning|behandlingsbemanning/i],
  ["Sanering och renhållning", /lokalvård|lokalvard|städbemanning|stadbemanning|saneringstjänst/i],
  ["Naturbruk", /lantbruksbemanning|skogsbemanning|trädgårdsbemanning|tradgardsbemanning/i],
  ["Säkerhet och bevakning", /bevakningstjänst|väktarbemanning|vaktarbemanning/i],
];

// Tjänsterna går att läsa direkt ur namnet när ordet står där. Excel-filen har
// ingen SNI-kod, så det här är enda signalen.
const TJANSTMONSTER = [
  ["Bemanning", /bemanning|staffing|personaluthyrning|uthyrning av personal/i],
  ["Rekrytering", /rekryter|recruit/i],
  ["Interim", /\binterim\b/i],
  ["Search", /executive search|\bsearch\b/i],
];

function normaliseraNamn(namn) {
  return String(namn || "")
    .toLowerCase()
    .replace(/\b(ab|aktiebolag|publ|handelsbolag|hb|kb)\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function storleksband(anstallda) {
  const n = Number(anstallda);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 50) return "Litet";
  if (n < 250) return "Medel";
  return "Stort";
}

function formateraOmsattning(mkr) {
  const n = Number(mkr);
  if (!Number.isFinite(n) || n === 0) return "";
  return `${n.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} Mkr`;
}

function formateraOrgnr(raw) {
  const siffror = String(raw || "").replace(/\D/g, "");
  return siffror.length === 10 ? `${siffror.slice(0, 6)}-${siffror.slice(6)}` : "";
}

function csvFalt(varde) {
  const text = varde === null || varde === undefined ? "" : String(varde);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// focus och services är text[] i databasen. Supabases CSV-import läser dem som
// Postgres arraylitteraler, alltså {"Bemanning","Rekrytering"} — inte som en
// egen avgränsare. Tomt blir {} och inte NULL, eftersom kolumnerna är not null
// med {} som standardvärde.
function pgArray(varden) {
  if (!varden.length) return "{}";
  return `{${varden.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")}}`;
}

async function lasStatiska() {
  const kod = await readFile(STATISKA, "utf-8");
  return new Function(`${kod.replace("export const", "const")}; return COMPANIES;`)();
}

async function main() {
  const wb = XLSX.readFile(new URL(EXCEL).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const rader = XLSX.utils.sheet_to_json(wb.Sheets["Bolag"], { defval: null });
  const befintliga = await lasStatiska();

  const befintligaNamn = new Set(befintliga.map((c) => normaliseraNamn(c.name)));
  const sedda = new Set();

  const ut = [];
  const statistik = { dubblett: 0, redanIRegistret: 0, saknarFalt: 0, medYrke: 0, medTjanst: 0 };

  let nastaId = FORSTA_ID;

  for (const rad of rader) {
    const namn = String(rad.Bolagsnamn || "").trim();
    const ort = String(rad.Ort || "").trim();
    const gata = String(rad["Besöksadress"] || "").trim();

    if (!namn || !ort || !gata) {
      statistik.saknarFalt++;
      continue;
    }

    const nyckel = normaliseraNamn(namn);
    if (befintligaNamn.has(nyckel)) {
      statistik.redanIRegistret++;
      continue;
    }
    if (sedda.has(nyckel)) {
      statistik.dubblett++;
      continue;
    }
    sedda.add(nyckel);

    const yrken = YRKESMONSTER.filter(([, re]) => re.test(namn)).map(([o]) => o);
    const tjanster = TJANSTMONSTER.filter(([, re]) => re.test(namn)).map(([t]) => t);
    if (yrken.length) statistik.medYrke++;
    if (tjanster.length) statistik.medTjanst++;

    const postnr = String(rad.Postnr || "").trim();

    ut.push({
      id: nastaId++,
      name: namn,
      org_number: formateraOrgnr(rad["Org.nr"]),
      city: ort,
      address: [gata, [postnr, ort].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      focus: pgArray(yrken),
      services: pgArray(tjanster),
      size_band: storleksband(rad["Anställda"]),
      founded: rad.Grundat || "",
      revenue: formateraOmsattning(rad["Omsättning (Mkr)"]),
      revenue_year: rad["Omsättningsår"] || "",
      employees: rad["Anställda"] ? String(rad["Anställda"]) : "",
      employees_year: rad["Omsättningsår"] || "",
      link: String(rad.Hemsida || "").trim(),
      contact: String(rad.Mejl || "").trim(),
    });
  }

  const rubriker = Object.keys(ut[0]);
  const csv = [rubriker.join(","), ...ut.map((r) => rubriker.map((k) => csvFalt(r[k])).join(","))].join("\n");
  await writeFile(UT_CSV, `﻿${csv}`, "utf-8");

  console.log(`Läste ${rader.length} rader ur Excel-filen.`);
  console.log(`  ${statistik.saknarFalt} saknade namn, ort eller adress`);
  console.log(`  ${statistik.redanIRegistret} finns redan i registret`);
  console.log(`  ${statistik.dubblett} dubbletter inom filen`);
  console.log(`\n${ut.length} bolag att importera, id ${FORSTA_ID}–${nastaId - 1}.`);
  console.log(`  ${statistik.medYrke} fick yrkesområde (${((100 * statistik.medYrke) / ut.length).toFixed(1)} %)`);
  console.log(`  ${statistik.medTjanst} fick tjänst (${((100 * statistik.medTjanst) / ut.length).toFixed(1)} %)`);
  console.log(`  ${ut.filter((r) => r.link).length} har hemsida, ${ut.filter((r) => r.contact).length} har mejl`);
  console.log(`\nSparat till scripts/data/import-granskning.csv`);
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
