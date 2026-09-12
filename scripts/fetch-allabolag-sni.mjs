#!/usr/bin/env node
// Hämtar ALLA aktiebolag under SNI 78100 (Arbetsförmedling och rekrytering) och
// 78201 (Personaluthyrning) från allabolag.se:s segmenteringsverktyg
// (https://www.allabolag.se/segmentering?naceIndustry=X) — en gratis, publik
// sida som inte är Cloudflare-skyddad och som bäddar in strukturerad data
// (namn, org.nr, adress, omsättning, anställda, status) direkt i sidkällan
// (Next.js __NEXT_DATA__), 10 bolag per sida.
//
// INGEN omsättningsgräns — alla aktiva aktiebolag tas med, även de med 0 kr.
//
// Sökmotorn har en hård djupgräns på 10 000 träffar (page*10 <= 10000).
// SNI 78201 har 15 198 träffar totalt, så för den delas frågan upp per län
// via ?location=<län> (bekräftat fungerande filter, varje läns delmängd
// ligger gott och väl under gränsen) — annars hade ~1/3 av bolagen aldrig
// nåtts. 78100 (6 243 träffar) ryms inom gränsen utan uppdelning.
//
// Filtrerar under körning till:
//   - Aktiebolag (org.nr är 10 siffror utan bindestreck OCH namnet
//     matchar "AB"/"Aktiebolag" — segmenteringsdatan saknar ett eget
//     bolagsform-fält, så det här är närmaste tillförlitliga proxy)
//   - Aktiv status
//
// Körs: node scripts/fetch-allabolag-sni.mjs

import { writeFile, mkdir } from "node:fs/promises";

const SNI_CODES = ["78.100", "78.201"];
const PAGE_SIZE = 10;
const CONCURRENCY = 4;
const DELAY_MS = 250;
const DEPTH_CAP_HITS = 9000; // säkerhetsmarginal under den verkliga 10 000-gränsen

const COUNTIES = [
  "Stockholm", "Västra Götaland", "Skåne", "Östergötland", "Uppsala", "Jönköping",
  "Halland", "Örebro", "Södermanland", "Dalarna", "Gävleborg", "Värmland",
  "Västmanland", "Norrbotten", "Västerbotten", "Kalmar", "Kronoberg",
  "Västernorrland", "Blekinge", "Jämtland", "Gotland",
];

const DATA_DIR = new URL("./data/", import.meta.url);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isLikelyAktiebolag(company) {
  const orgnr = company.organisationNumber || "";
  const tenDigits = /^\d{10}$/.test(orgnr);
  const nameLooksAB = /\bAB\b|aktiebolag/i.test(company.name || "");
  return tenDigits && nameLooksAB;
}

async function fetchPage(sni, page, location) {
  const params = new URLSearchParams({ naceIndustry: sni, page: String(page) });
  if (location) params.set("location", location);
  const url = `https://www.allabolag.se/segmentering?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} för ${url}`);
  const text = await res.text();
  const m = text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`Ingen __NEXT_DATA__ hittad för ${url}`);
  const json = JSON.parse(m[1]);
  return json.props.pageProps;
}

function toRecord(c, sni) {
  const primarySni = (c.naceCategories || [])[0] || "";
  const isPrimary = primarySni.startsWith(sni.replace(".", ""));
  return {
    name: c.name,
    orgnr: c.organisationNumber,
    address: c.visitorAddress?.addressLine || c.postalAddress?.addressLine || null,
    zipCode: c.postalAddress?.zipCode || null,
    city: c.postalAddress?.postPlace || null,
    municipality: c.location?.municipality || null,
    naceCategories: c.naceCategories || [],
    staffingIsPrimaryNace: isPrimary,
    revenue_tkr: c.revenue != null ? Number(c.revenue) : null,
    profit_tkr: c.profit != null ? Number(c.profit) : null,
    accountsYear: c.companyAccountsLastUpdatedDate || null,
    foundedYear: c.foundationYear || null,
    employees: c.numberOfEmployees || null,
    homePage: c.homePage || null,
  };
}

async function fetchBucket(sni, location, matchedMap, counters) {
  const first = await fetchPage(sni, 1, location);
  const totalHits = first.numberOfHits;
  const totalPages = Math.ceil(totalHits / PAGE_SIZE);
  const label = location ? `SNI ${sni} / ${location}` : `SNI ${sni}`;
  console.log(`${label}: ${totalHits} bolag, ${totalPages} sidor.`);

  function processCompanies(companies) {
    for (const c of companies) {
      counters.scanned++;
      if (c.status?.status !== "ACTIVE") continue;
      if (!isLikelyAktiebolag(c)) continue;
      const rec = toRecord(c, sni);
      if (!matchedMap.has(rec.orgnr)) {
        matchedMap.set(rec.orgnr, rec);
        counters.matched++;
      }
    }
  }
  processCompanies(first.companies);

  const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const page = pages[next++];
      try {
        const pp = await fetchPage(sni, page, location);
        processCompanies(pp.companies);
      } catch (err) {
        console.warn(`Sida ${page} (${label}) misslyckades: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function fetchSniCode(sni, matchedMap) {
  console.log(`\n=== SNI ${sni} ===`);
  const counters = { scanned: 0, matched: 0 };

  const probe = await fetchPage(sni, 1);
  if (probe.numberOfHits <= DEPTH_CAP_HITS) {
    await fetchBucket(sni, null, matchedMap, counters);
  } else {
    console.log(`${probe.numberOfHits} träffar överstiger djupgränsen — delar upp per län.`);
    for (const county of COUNTIES) {
      await fetchBucket(sni, county, matchedMap, counters);
    }
  }
  console.log(`SNI ${sni} klart: ${counters.scanned} genomsökta, ${counters.matched} nya matchande (AB + aktiv).`);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const dirPath = new URL(DATA_DIR).pathname.replace(/^\/([A-Za-z]:)/, "$1");

  const matchedMap = new Map();
  for (const sni of SNI_CODES) {
    await fetchSniCode(sni, matchedMap);
  }

  const combined = [...matchedMap.values()];
  await writeFile(
    `${dirPath}allabolag-combined.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), count: combined.length, companies: combined }, null, 2),
    "utf-8"
  );
  console.log(`\nTotalt unika bolag (SNI 78100+78201, AB, aktiva, ingen omsättningsgräns): ${combined.length}`);
  console.log(`Sparat till scripts/data/allabolag-combined.json`);
}

main().catch((err) => {
  console.error("Misslyckades:", err);
  process.exit(1);
});
