#!/usr/bin/env node
// Hämtar Kompetensföretagens fullständiga medlemslista (auktoriserade bemannings-/
// rekryterings-/omställningsföretag) direkt från sidans server-renderade HTML.
//
// Sidan lagrar hela medlemslistan i ett data-members-attribut på .Member-search,
// komprimerad som: JSON -> raw deflate -> base64. Vue-widgeten på sidan gör
// JSON.parse(RawDeflate.inflate(atob(attr))) klientsidigt (se app.8e9082.js,
// metoden getAttributeData). Vi replikerar samma avkodning här med Nodes
// inbyggda zlib, så vi slipper en headless webbläsare helt.
//
// Körs: node scripts/fetch-kompetensforetagen.mjs

import { inflateRawSync } from "node:zlib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://www.kompetensforetagen.se/hitta-ett-auktoriserat-foretag/";
const OUT_DIR = new URL("./data/", import.meta.url);

function decodeAttr(html, attrName) {
  const re = new RegExp(`data-${attrName}="([^"]*)"`);
  const match = html.match(re);
  if (!match) {
    throw new Error(`Hittade inte data-${attrName}-attributet i sidans HTML — sidstrukturen kan ha ändrats.`);
  }
  const decoded = match[1]
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
  const buf = Buffer.from(decoded, "base64");
  const inflated = inflateRawSync(buf).toString("utf-8");
  return JSON.parse(inflated);
}

async function main() {
  console.log(`Hämtar ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RecruitableDataSync/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} vid hämtning av sidan`);
  }
  const html = await res.text();

  const members = decodeAttr(html, "members");
  console.log(`Avkodade ${members.length} medlemmar.`);

  let undergroups = [];
  let attrNames = {};
  try {
    undergroups = decodeAttr(html, "undergroups");
  } catch {
    console.warn("Kunde inte avkoda data-undergroups (icke-kritiskt, hoppar över).");
  }
  try {
    attrNames = decodeAttr(html, "attr_names");
  } catch {
    console.warn("Kunde inte avkoda data-attr_names (icke-kritiskt, hoppar över).");
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(new URL(OUT_DIR).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "kompetensforetagen-members.json");
  await writeFile(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), members, undergroups, attrNames }, null, 2), "utf-8");
  console.log(`Sparade rådata till ${outPath}`);

  if (members[0]) {
    console.log("\nExempelpost (första medlemmen):");
    console.log(JSON.stringify(members[0], null, 2));
  }
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
