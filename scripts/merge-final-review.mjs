#!/usr/bin/env node
// Slår ihop research-resultatet (hemsida/mejl för topp 200) in i allabolag-final-review,
// tar bort telefon, lägger till omsättningsår, och plockar bort bolag som forskningen
// bekräftat inte faktiskt hör till bemannings-/rekryteringsbranschen trots SNI-klassning.

import { readFileSync, writeFileSync } from "node:fs";

const DATA_DIR = new URL("./data/", import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function csvEscape(s) {
  if (s == null) return "";
  const str = String(s);
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

const EXCLUDE_ORGNR = new Set([
  "5569084204", // Hallands Hamnar AB - hamnoperatör
  "5565810248", // Gottebiten Strömstad AB - gränshandel godis/tobak
  "5569132532", // Tor-Ön Fiske AB - fiskeindustri
  "5591561294", // Worknode Freelance AB - egenanställningsplattform
  "5590127253", // SAMgruppen AB - egenanställning/fakturering
  "5568875602", // Svevia Betong AB - anläggning/betong
  "5590773593", // Cansolo AB - egenanställningsplattform
  "5569769648", // SA Markanläggning AB - mark-/anläggningsentreprenad
  "5591269286", // Adway AB - HR-tech/rekryteringsmarknadsföring, ej bemanningsbyrå
  "5566091459", // MAQS Advokatbyrå Sverige AB - advokatbyrå
  "5569561185", // Rådek Redovisning & Revision AB - redovisning/revision
  "5590332648", // Jobtip AB - HR-tech/annonsdistribution
]);

const mainRaw = readFileSync(new URL("allabolag-final-review.csv", DATA_DIR), "utf-8").replace(/^﻿/, "");
const mainRows = parseCsv(mainRaw);
const mainHeader = mainRows[0];
const mainBody = mainRows.slice(1).filter((r) => r.length > 1);

const researchRaw = readFileSync(new URL("website-research-final.csv", DATA_DIR), "utf-8").replace(/^﻿/, "");
const researchRows = parseCsv(researchRaw);
const researchHeader = researchRows[0];
const researchBody = researchRows.slice(1).filter((r) => r.length > 1);
const rIdx = Object.fromEntries(researchHeader.map((h, i) => [h, i]));
const researchByOrgnr = new Map(researchBody.map((r) => [r[rIdx["Org.nr"]], r]));

const details = JSON.parse(readFileSync(new URL("allabolag-details.json", DATA_DIR), "utf-8"));
const accountsYearByOrgnr = new Map(details.companies.map((c) => [c.orgnr, c.accountsYear || ""]));

const mIdx = Object.fromEntries(mainHeader.map((h, i) => [h, i]));

const newHeader = ["Bolagsnamn", "Org.nr", "Besöksadress", "Postnr", "Ort", "Kommun", "Omsättning (Mkr)", "Omsättningsår", "Anställda", "Grundat", "Hemsida", "Mejl", "Status"];

let excludedCount = 0;
let websiteFilled = 0;
let emailFilled = 0;

const newBody = [];
for (const row of mainBody) {
  const orgnr = row[mIdx["Org.nr"]];
  if (EXCLUDE_ORGNR.has(orgnr)) {
    excludedCount++;
    continue;
  }
  const research = researchByOrgnr.get(orgnr);
  const existingWebsite = row[mIdx["Hemsida"]];
  const website = (research && research[rIdx["Hemsida"]]) || existingWebsite || "";
  const email = (research && research[rIdx["Mejl"]]) || "";
  if (research && research[rIdx["Hemsida"]]) websiteFilled++;
  if (email) emailFilled++;

  newBody.push([
    row[mIdx["Bolagsnamn"]],
    orgnr,
    row[mIdx["Besöksadress"]],
    row[mIdx["Postnr"]],
    row[mIdx["Ort"]],
    row[mIdx["Kommun"]],
    row[mIdx["Omsättning (Mkr)"]],
    accountsYearByOrgnr.get(orgnr) || "",
    row[mIdx["Anställda"]],
    row[mIdx["Grundat"]],
    website,
    email,
    row[mIdx["Status"]],
  ]);
}

const outCsv = [newHeader, ...newBody].map((r) => r.map(csvEscape).join(",")).join("\n");
writeFileSync(new URL("allabolag-final-review.csv", DATA_DIR), "﻿" + outCsv, "utf-8");

console.log(`Borttagna (fel bransch): ${excludedCount}`);
console.log(`Hemsidor ifyllda från research: ${websiteFilled}`);
console.log(`Mejladresser ifyllda: ${emailFilled}`);
console.log(`Kvar totalt: ${newBody.length}`);
