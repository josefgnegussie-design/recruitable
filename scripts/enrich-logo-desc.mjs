#!/usr/bin/env node
// Hämtar logga + kort beskrivning för varje gap-kandidat (scripts/data/gap-candidates.json)
// direkt från bolagets egen hemsida (domänen vi redan har från Kompetensföretagen).
// Motsvarar "Webbscraping (egen domän)" i docs/bolagsdata-specifikation.md.
//
// Hämtar INTE adress/omsättning/anställda — de kräver Bolagsverket-API resp. UC/Allabolag,
// vilket kräver att ni registrerar konto/avtal själva (se separat instruktion).
//
// Körs: node scripts/enrich-logo-desc.mjs

import { readFile, writeFile } from "node:fs/promises";

const GAP_PATH = new URL("./data/gap-candidates.json", import.meta.url);
const OUT_PATH = new URL("./data/gap-enriched.json", import.meta.url);

const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;

function toAbsoluteUrl(maybeRelative, baseUrl) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractMeta(html, names) {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return m[1].trim();
    }
  }
  return null;
}

function extractIconHref(html) {
  const rels = ["apple-touch-icon", "icon", "shortcut icon"];
  for (const rel of rels) {
    const re = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${rel}[^"']*["']`, "i");
    const m = html.match(re) || html.match(re2);
    if (m && m[1]) return m[1];
  }
  return null;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecruitableDataSync/1.0; +https://recruitable.se)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function enrichOne(member) {
  const rawUrl = member.url || (member.domain ? `https://${member.domain}` : null);
  if (!rawUrl) return { ...member, enrichStatus: "no-url" };

  const startUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  try {
    const res = await fetchWithTimeout(startUrl, TIMEOUT_MS);
    if (!res.ok) return { ...member, enrichStatus: `http-${res.status}` };
    const html = await res.text();
    const finalUrl = res.url || startUrl;

    const desc = extractMeta(html, ["description", "og:description"]);
    const ogImage = extractMeta(html, ["og:image"]);
    const icon = extractIconHref(html);

    const logo = toAbsoluteUrl(ogImage, finalUrl) || toAbsoluteUrl(icon, finalUrl) || toAbsoluteUrl("/favicon.ico", finalUrl);

    return {
      ...member,
      desc: desc || null,
      logo: logo || null,
      enrichStatus: "ok",
    };
  } catch (err) {
    return { ...member, enrichStatus: `error: ${err.message}` };
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      const done = i + 1;
      if (done % 25 === 0 || done === items.length) {
        console.log(`... ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

async function main() {
  const { gap } = JSON.parse(await readFile(GAP_PATH, "utf-8"));
  console.log(`Berikar logga + beskrivning för ${gap.length} bolag (concurrency ${CONCURRENCY})...`);

  const enriched = await runWithConcurrency(gap, CONCURRENCY, enrichOne);

  const ok = enriched.filter((m) => m.enrichStatus === "ok" && (m.desc || m.logo));
  const failed = enriched.filter((m) => !(m.enrichStatus === "ok" && (m.desc || m.logo)));

  console.log(`\nKlart: ${ok.length} lyckades, ${failed.length} misslyckades/saknar data.`);

  await writeFile(
    new URL(OUT_PATH).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    JSON.stringify({ generatedAt: new Date().toISOString(), total: gap.length, ok: ok.length, failed: failed.length, members: enriched }, null, 2),
    "utf-8"
  );
  console.log(`Sparat till scripts/data/gap-enriched.json`);
}

main().catch((err) => {
  console.error("Misslyckades:", err);
  process.exit(1);
});
