#!/usr/bin/env node
// Bygger uppslagsdatan postnummer → postort ur GeoNames öppna data
// (CC BY 4.0, https://download.geonames.org/export/zip/).
//
// Finns för autofyllet i adressfältet på Mina sidor: bolaget skriver postnummer
// eller postort och får resten ifylld. Poängen är inte främst bekvämlighet utan
// att postorten blir stavad likadant varje gång — companies.office_cities
// härleds ur den, och "Göteborg", "Goteborg" och "Gbg" skulle annars bli tre
// olika orter i sökningen och på korten.
//
// Gatuadresser ingår inte. Det finns ingen fri svensk källa för dem;
// Lantmäteriet och PostNord kräver avtal, och kartleverantörernas villkor
// begränsar vad som får sparas. Gatan skriver bolaget själv.
//
// Varför en fil i repot och inte en tabell i databasen: knappt nitton tusen
// rader är för lite för att motivera en migration, en seed på över en megabyte
// att klistra in i SQL-editorn, och en databasrundtur per tangenttryck i
// sökfältet. Filen läses bara på servern (se app/api/postnummer/sok) och når
// aldrig webbläsaren. Datan ändras ett par gånger om året — kör om scriptet,
// committa, driftsätt.
//
// Körs: node scripts/bygg-postnummer.mjs

import { writeFile } from "node:fs/promises";
import { hamtaGeonames, radTillPost } from "./geonames.mjs";

const UT = new URL("../lib/data/postnummer.json", import.meta.url);

async function main() {
  console.log("Hämtar postnummerdata från GeoNames...");
  const text = await hamtaGeonames();

  // Samma postnummer förekommer i flera rader när ett område spänner över
  // kommungränser. Första raden vinner — de skiljer sig bara i koordinat.
  const poster = new Map();
  let hoppade = 0;

  for (const rad of text.split("\n")) {
    if (!rad.trim()) continue;
    const post = radTillPost(rad);
    if (!post) {
      hoppade++;
      continue;
    }
    if (!poster.has(post.postnummer)) poster.set(post.postnummer, post);
  }

  const lista = [...poster.values()].sort((a, b) => a.postnummer.localeCompare(b.postnummer));

  // Postorterna interneras: 1 800 namn delas av 19 000 poster, och att skriva ut
  // "Stockholm" tusentals gånger tredubblar filen utan att tillföra något.
  const orter = [...new Set(lista.map((p) => p.postort))].sort((a, b) => a.localeCompare(b, "sv"));
  const ortIndex = new Map(orter.map((o, i) => [o, i]));

  const ut = {
    kalla: "GeoNames (CC BY 4.0), https://download.geonames.org/export/zip/",
    byggd: new Date().toISOString().slice(0, 10),
    orter,
    // [postnummer, ortens index, lat, lng] — koordinaten finns med eftersom
    // registret redan använder samma källa för bolagens lat/lng, och en adress
    // med koordinat går att placera på karta utan ett nytt uppslag.
    poster: lista.map((p) => [p.postnummer, ortIndex.get(p.postort), p.lat, p.lng]),
  };

  await writeFile(UT, JSON.stringify(ut), "utf-8");

  const storlek = (JSON.stringify(ut).length / 1024 / 1024).toFixed(2);
  console.log(`  ${lista.length} postnummer, ${orter.length} postorter. ${hoppade} rader utan giltigt postnummer hoppades över.`);
  console.log(`Sparat till lib/data/postnummer.json (${storlek} MB)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
