#!/usr/bin/env node
// Jämför Kompetensföretagens auktoriserade medlemslista (scripts/data/kompetensforetagen-members.json,
// se fetch-kompetensforetagen.mjs) mot den befintliga listan i lib/companies.js.
//
// Matchar på (1) domän, sedan (2) normaliserat bolagsnamn — domän är pålitligare
// eftersom bolagsnamn ofta skrivs olika (t.ex. "AB" vs "(publ)" vs mellanslag).
//
// Körs: node scripts/diff-companies.mjs

import { readFile, writeFile } from "node:fs/promises";

const COMPANIES_JS_PATH = new URL("../lib/companies.js", import.meta.url);
const MEMBERS_JSON_PATH = new URL("./data/kompetensforetagen-members.json", import.meta.url);
const OUT_PATH = new URL("./data/gap-candidates.json", import.meta.url);

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\(publ\)/g, "")
    .replace(/\b(ab|aktiebolag|hb|kb|ek\.?\s?för(ening)?)\b/g, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(urlOrDomain) {
  if (!urlOrDomain) return null;
  try {
    const withProtocol = urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}`;
    const host = new URL(withProtocol).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function loadExistingCompanies() {
  const raw = await readFile(COMPANIES_JS_PATH, "utf-8");
  const cjsSource = raw.replace(/^export const COMPANIES/, "const COMPANIES") + "\nmodule.exports = { COMPANIES };\n";
  const Module = (await import("node:module")).default;
  const tempMod = new Module(COMPANIES_JS_PATH.pathname);
  tempMod._compile(cjsSource, COMPANIES_JS_PATH.pathname.replace(/\.js$/, ".cjs"));
  return tempMod.exports.COMPANIES;
}

async function main() {
  const existing = await loadExistingCompanies();
  const { members } = JSON.parse(await readFile(MEMBERS_JSON_PATH, "utf-8"));

  const existingDomains = new Set(existing.map((c) => normalizeDomain(c.link)).filter(Boolean));
  const existingNames = new Set(existing.map((c) => normalizeName(c.name)));

  const matched = [];
  const gap = [];

  for (const member of members) {
    const domain = normalizeDomain(member.url) ?? normalizeDomain(member.domain);
    const name = normalizeName(member.name);
    const isMatch = (domain && existingDomains.has(domain)) || existingNames.has(name);
    if (isMatch) {
      matched.push(member);
    } else {
      gap.push(member);
    }
  }

  console.log(`Befintliga bolag i lib/companies.js: ${existing.length}`);
  console.log(`Kompetensföretagens auktoriserade medlemmar: ${members.length}`);
  console.log(`— redan i listan: ${matched.length}`);
  console.log(`— saknas (gap): ${gap.length}`);

  await writeFile(
    new URL(OUT_PATH).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    JSON.stringify({ generatedAt: new Date().toISOString(), totalMembers: members.length, matchedCount: matched.length, gap }, null, 2),
    "utf-8"
  );
  console.log(`\nSaknade bolag sparade till scripts/data/gap-candidates.json`);
}

main().catch((err) => {
  console.error("Misslyckades:", err);
  process.exit(1);
});
