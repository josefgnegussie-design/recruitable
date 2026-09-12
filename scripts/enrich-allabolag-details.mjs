#!/usr/bin/env node
// Berikar de bolag som har bemanning/rekrytering som primär SNI-kod
// (staffingIsPrimaryNace: true i allabolag-combined.json) med hemsida,
// besöksadress, e-post, telefon och logga — hämtat från varje bolags
// egen detaljsida på allabolag.se (https://www.allabolag.se/<orgnr>/x
// omdirigerar automatiskt till rätt sida, ingen slug behöver kännas till).
//
// Körs: node scripts/enrich-allabolag-details.mjs

import { readFile, writeFile } from "node:fs/promises";

const COMBINED_PATH = new URL("./data/allabolag-combined.json", import.meta.url);
const OUT_PATH = new URL("./data/allabolag-details.json", import.meta.url);

const CONCURRENCY = 5;
const DELAY_MS = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDetail(orgnr) {
  const url = `https://www.allabolag.se/${orgnr}/x`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
  });
  if (!res.ok) return { status: `http-${res.status}` };
  const text = await res.text();
  const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { status: "no-next-data" };
  const json = JSON.parse(m[1]);
  const company = json.props.pageProps.company;
  if (!company) return { status: "no-company" };

  return {
    status: "ok",
    homePage: company.homePage || null,
    email: company.email || null,
    phone: company.phone || company.mobile || null,
    logo: company.logo || null,
    description: company.description || company.purpose || null,
    visitorAddress: company.visitorAddress
      ? {
          addressLine: company.visitorAddress.addressLine || null,
          zipCode: company.visitorAddress.zipCode || null,
          postPlace: company.visitorAddress.postPlace || null,
        }
      : null,
  };
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      await sleep(DELAY_MS);
      const done = i + 1;
      if (done % 250 === 0 || done === items.length) {
        console.log(`... ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

async function main() {
  const combined = JSON.parse(await readFile(COMBINED_PATH, "utf-8"));
  const targets = combined.companies.filter((c) => c.staffingIsPrimaryNace);
  console.log(`Berikar ${targets.length} bolag med detaljsidedata (concurrency ${CONCURRENCY})...`);

  const results = await runWithConcurrency(targets, CONCURRENCY, async (c) => {
    try {
      const detail = await fetchDetail(c.orgnr);
      return { ...c, detail };
    } catch (err) {
      return { ...c, detail: { status: `error: ${err.message}` } };
    }
  });

  const withWebsite = results.filter((r) => r.detail.status === "ok" && r.detail.homePage);
  const withVisitorAddr = results.filter((r) => r.detail.status === "ok" && r.detail.visitorAddress?.addressLine);
  console.log(`\nKlart: ${withWebsite.length}/${results.length} har hemsida, ${withVisitorAddr.length}/${results.length} har besöksadress.`);

  await writeFile(
    new URL(OUT_PATH).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    JSON.stringify({ generatedAt: new Date().toISOString(), total: results.length, withWebsite: withWebsite.length, companies: results }, null, 2),
    "utf-8"
  );
  console.log("Sparat till scripts/data/allabolag-details.json");
}

main().catch((err) => {
  console.error("Misslyckades:", err);
  process.exit(1);
});
