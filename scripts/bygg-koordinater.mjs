#!/usr/bin/env node
// Sätter koordinater på bolagen i registret.
//
// Underlaget från allabolag saknar latitud och longitud, men har postnummer.
// GeoNames publicerar alla svenska postnummer med koordinater som öppen data
// (CC BY 4.0) — en enda nedladdning i stället för tusentals uppslag mot en
// karttjänst, som både tar timmar och tänjer på deras användarvillkor.
//
// Precisionen blir postnummerområdets mittpunkt, inte gatuadressen. Det räcker
// gott för "bolag nära dig", som sorterar på avstånd från en ort — och det är
// ärligare än att låtsas veta var porten ligger.
//
// Körs: node scripts/bygg-koordinater.mjs
// Skriver SQL till supabase/satt_koordinater.sql

import { readFile, writeFile } from "node:fs/promises";

const GEONAMES = "https://download.geonames.org/export/zip/SE.zip";
const KALLA_CSV = new URL("./data/import-granskning.csv", import.meta.url);
const UT_SQL = new URL("../supabase/satt_koordinater.sql", import.meta.url);

function parseCSV(text) {
  const rader = [];
  let falt = "";
  let rad = [];
  let iCitat = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (iCitat) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          falt += '"';
          i++;
        } else iCitat = false;
      } else falt += c;
    } else if (c === '"') iCitat = true;
    else if (c === ",") {
      rad.push(falt);
      falt = "";
    } else if (c === "\n") {
      rad.push(falt);
      rader.push(rad);
      rad = [];
      falt = "";
    } else if (c !== "\r") falt += c;
  }
  if (falt || rad.length) {
    rad.push(falt);
    rader.push(rad);
  }
  return rader;
}

// Zip-filen packas upp utan beroenden: posterna ligger deflate-komprimerade och
// node:zlib klarar dem direkt.
async function hamtaGeonames() {
  const { inflateRawSync } = await import("node:zlib");
  const svar = await fetch(GEONAMES);
  if (!svar.ok) throw new Error(`Kunde inte hämta GeoNames (${svar.status})`);
  const zip = Buffer.from(await svar.arrayBuffer());

  // Arkivet innehåller både readme.txt och SE.txt, så posterna i den centrala
  // katalogen (signatur PK\x01\x02) gås igenom tills rätt namn dyker upp.
  // Storleken läses därifrån och inte ur det lokala filhuvudet, som står som
  // noll när arkivet har en databeskrivare.
  const SIGNATUR = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

  for (let post = zip.indexOf(SIGNATUR); post >= 0; post = zip.indexOf(SIGNATUR, post + 4)) {
    const namnLangd = zip.readUInt16LE(post + 28);
    const namn = zip.subarray(post + 46, post + 46 + namnLangd).toString("utf-8");
    if (namn.toUpperCase() !== "SE.TXT") continue;

    const komprimerad = zip.readUInt32LE(post + 20);
    const lokaltHuvud = zip.readUInt32LE(post + 42);
    const dataStart =
      lokaltHuvud + 30 + zip.readUInt16LE(lokaltHuvud + 26) + zip.readUInt16LE(lokaltHuvud + 28);

    return inflateRawSync(zip.subarray(dataStart, dataStart + komprimerad)).toString("utf-8");
  }

  throw new Error("Hittade ingen SE.txt i arkivet");
}

function byggUppslag(text) {
  const perPostnr = new Map();
  const perOrt = new Map();

  for (const rad of text.split("\n")) {
    if (!rad.trim()) continue;
    const f = rad.split("\t");
    const lat = parseFloat(f[9]);
    const lng = parseFloat(f[10]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const postnr = (f[1] || "").replace(/\s/g, "");
    const ort = (f[2] || "").trim().toLowerCase();
    if (postnr && !perPostnr.has(postnr)) perPostnr.set(postnr, [lat, lng]);
    if (ort && !perOrt.has(ort)) perOrt.set(ort, [lat, lng]);
  }

  return { perPostnr, perOrt };
}

async function main() {
  console.log("Hämtar postnummerdata från GeoNames...");
  const { perPostnr, perOrt } = byggUppslag(await hamtaGeonames());
  console.log(`  ${perPostnr.size} postnummer, ${perOrt.size} orter.`);

  const rader = parseCSV((await readFile(KALLA_CSV, "utf-8")).replace(/^﻿/, ""));
  const rubrik = rader[0];
  const iId = rubrik.indexOf("id");
  const iOrt = rubrik.indexOf("city");
  const iAdress = rubrik.indexOf("address");
  const bolag = rader.slice(1).filter((r) => r.length === rubrik.length);

  const traffar = [];
  const statistik = { postnr: 0, ort: 0, utan: 0 };

  for (const rad of bolag) {
    const match = rad[iAdress].match(/\b(\d{3} ?\d{2})\b/);
    const postnr = match ? match[1].replace(/\s/g, "") : null;

    let koordinat = postnr ? perPostnr.get(postnr) : null;
    if (koordinat) statistik.postnr++;
    else {
      koordinat = perOrt.get(rad[iOrt].trim().toLowerCase());
      if (koordinat) statistik.ort++;
    }

    if (!koordinat) {
      statistik.utan++;
      continue;
    }
    traffar.push([Number(rad[iId]), koordinat[0], koordinat[1]]);
  }

  const varden = traffar.map(([id, lat, lng]) => `(${id},${lat},${lng})`).join(",\n  ");

  const sql = `-- Koordinater för de importerade bolagen.
-- Genererad av scripts/bygg-koordinater.mjs ur GeoNames öppna postnummerdata
-- (CC BY 4.0). Precisionen är postnummerområdets mittpunkt, inte gatuadressen.
--
-- Rör bara rader som saknar koordinater, så manuellt satta värden bevaras.

update companies as c
set lat = v.lat, lng = v.lng
from (values
  ${varden}
) as v(id, lat, lng)
where c.id = v.id
  and c.lat is null;

select count(*) filter (where lat is not null) as med_koordinater,
       count(*) as totalt
from companies;
`;

  await writeFile(UT_SQL, sql, "utf-8");

  console.log(`\n${traffar.length} av ${bolag.length} bolag fick koordinater:`);
  console.log(`  ${statistik.postnr} via postnummer`);
  console.log(`  ${statistik.ort} via ortsnamn`);
  console.log(`  ${statistik.utan} utan träff`);
  console.log(`\nSparat till supabase/satt_koordinater.sql`);

  if (process.argv.includes("--applicera")) await applicera(traffar);
}

// Skriver direkt till databasen i stället för att lämna över SQL. Kräver
// NEXT_PUBLIC_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i miljön:
//   node --env-file=.env.local scripts/bygg-koordinater.mjs --applicera
//
// Bolag som delar postnummer delar koordinat, så uppdateringarna grupperas per
// koordinatpar — 3 711 bolag blir några tusen anrop i stället för ett per rad.
// Filtret rör bara rader som saknar koordinater; redan satta värden lämnas.
async function applicera(traffar) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const nyckel = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !nyckel) throw new Error("Saknar Supabase-uppgifter i miljön");

  const perKoordinat = new Map();
  for (const [id, lat, lng] of traffar) {
    const nyckelPar = `${lat},${lng}`;
    if (!perKoordinat.has(nyckelPar)) perKoordinat.set(nyckelPar, { lat, lng, ider: [] });
    perKoordinat.get(nyckelPar).ider.push(id);
  }

  console.log(`\nSkriver till databasen: ${perKoordinat.size} koordinatpar...`);

  const huvuden = {
    apikey: nyckel,
    Authorization: `Bearer ${nyckel}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  let klara = 0;
  let fel = 0;

  for (const { lat, lng, ider } of perKoordinat.values()) {
    // Långa id-listor delas upp så att adressen inte blir för lång.
    for (let i = 0; i < ider.length; i += 100) {
      const del = ider.slice(i, i + 100);
      const svar = await fetch(
        `${url}/rest/v1/companies?id=in.(${del.join(",")})&lat=is.null`,
        { method: "PATCH", headers: huvuden, body: JSON.stringify({ lat, lng }) }
      );
      if (!svar.ok) {
        fel++;
        if (fel <= 3) console.error(`  fel ${svar.status}: ${(await svar.text()).slice(0, 160)}`);
      } else {
        klara += del.length;
      }
    }
  }

  console.log(`Klart: ${klara} bolag uppdaterade, ${fel} misslyckade anrop.`);
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
