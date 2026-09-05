#!/usr/bin/env node
// Sammanställer de 100 största bolagen i registret till en Excel-fil för
// genomgång: de som redan har profil, och de 57 som fått yrkesområden, tjänster
// och beskrivning framtagna ur Bolagsverket och bolagens hemsidor.
//
// Vision lämnas tom för de nya. Fältet visas inom citattecken som bolagets egna
// ord — att skriva det åt dem vore att lägga ord i munnen på ett verkligt bolag.
//
// Körs: XLSX_PATH=... node --env-file=.env.local scripts/bygg-toppbolag-excel.mjs

import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require(process.env.XLSX_PATH || "xlsx");

const KLASSIFICERING = new URL("./data/toppbolag-klassificering.json", import.meta.url);
const RESEARCH = new URL("./data/research-toppbolag.json", import.meta.url);
const UT = new URL("./data/toppbolag-100.xlsx", import.meta.url);

const ANTAL = 100;

function omsattningTillTal(text) {
  if (!text) return 0;
  const m = String(text).replace(/\s/g, "").match(/([\d,.]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0;
}

async function hamtaRegistret() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Saknar Supabase-uppgifter i miljön");

  const alla = [];
  for (let from = 0; ; from += 1000) {
    const svar = await fetch(
      `${url}/rest/v1/companies?select=id,name,org_number,city,address,revenue,employees,founded,link,contact,logo,vision,description,focus,services,ka&order=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } }
    );
    const del = await svar.json();
    alla.push(...del);
    if (del.length < 1000) break;
  }
  return alla;
}

async function main() {
  const { bolag: klass } = JSON.parse(await readFile(KLASSIFICERING, "utf-8"));
  const research = JSON.parse(await readFile(RESEARCH, "utf-8"));
  const mejlPerId = new Map(
    research.bolag.map((b) => [String(b.id), b.hemsida?.mejl?.[0] || ""])
  );

  const alla = await hamtaRegistret();
  alla.forEach((b) => (b._oms = omsattningTillTal(b.revenue)));
  const topp = [...alla].sort((a, b) => b._oms - a._oms).slice(0, ANTAL);

  const rader = [
    [
      "Id", "Bolagsnamn", "Ort", "Omsättning", "Anställda", "Status",
      "Yrkesområde", "Tjänst", "Beskrivning", "Vision (fyll i)",
      "Hemsida", "Mejl", "Logotyp (fyll i)", "Kollektivavtal", "Anmärkning",
    ],
  ];

  let harProfil = 0;
  let foreslagna = 0;

  for (const b of topp) {
    const k = klass[String(b.id)];
    const nyttFokus = k?.focus?.length ? k.focus : null;
    const nyaTjanster = k?.services?.length ? k.services : null;

    if (b.vision) harProfil++;
    else if (k) foreslagna++;

    rader.push([
      b.id,
      b.name,
      b.city,
      b._oms,
      b.employees || "",
      b.vision ? "har profil" : "FÖRSLAG — granska",
      (nyttFokus || b.focus || []).join(", "),
      (nyaTjanster || b.services || []).join(", "),
      b.description || k?.description || "",
      b.vision || "",
      b.link || "",
      b.contact || mejlPerId.get(String(b.id)) || "",
      b.logo || "",
      b.ka ? "ja" : "",
      k?.anmarkning || "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rader);
  ws["!cols"] = [
    { wch: 6 }, { wch: 38 }, { wch: 16 }, { wch: 11 }, { wch: 10 }, { wch: 17 },
    { wch: 34 }, { wch: 26 }, { wch: 70 }, { wch: 46 },
    { wch: 32 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 52 },
  ];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }) };
  ws["!freeze"] = { xSplit: 2, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Topp 100");
  XLSX.writeFile(wb, new URL(UT).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

  const flaggade = topp.filter((b) => klass[String(b.id)]?.anmarkning).length;
  console.log(`${topp.length} bolag i filen.`);
  console.log(`  ${harProfil} har redan profil`);
  console.log(`  ${foreslagna} har förslag att granska`);
  console.log(`  ${flaggade} är flaggade som tveksamma för registret`);
  console.log(`\nSparat till scripts/data/toppbolag-100.xlsx`);
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
