#!/usr/bin/env node
// Slår upp adress, bolagsform, registreringsdatum och SNI-kod för kända org.nr
// via Bolagsverkets "Värdefulla datamängder"-API (se ~/Downloads/swagger.json).
//
// Körs: node --env-file=.env.local scripts/enrich-bolagsverket.mjs
//
// Kräver miljövariabler:
//   BOLAGSVERKET_CLIENT_ID
//   BOLAGSVERKET_CLIENT_SECRET
//   BOLAGSVERKET_BASE_URL (valfri, default = acceptans-/testmiljön nedan)

import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.BOLAGSVERKET_BASE_URL || "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
// Testmiljön (accept2) har sin egen token-endpoint på portal-accept2, skild från
// produktionens portal.api.bolagsverket.se — verifierat 2026-08-17 (portal.api gav
// 401 invalid_client för testnycklar, portal-accept2 fungerade). Produktion verifierad
// samma dag mot gw.api.bolagsverket.se + portal.api.bolagsverket.se med riktigt org.nr.
const TOKEN_URL = process.env.BOLAGSVERKET_TOKEN_URL || (BASE_URL.includes("accept2")
  ? "https://portal-accept2.api.bolagsverket.se/oauth2/token"
  : "https://portal.api.bolagsverket.se/oauth2/token");
const SCOPE = "vardefulla-datamangder:read";

const GAP_PATH = new URL("./data/gap-candidates.json", import.meta.url);
const OUT_PATH = new URL("./data/gap-bolagsverket.json", import.meta.url);

const CONCURRENCY = Number(process.env.BOLAGSVERKET_CONCURRENCY || 1);
const DELAY_MS = Number(process.env.BOLAGSVERKET_DELAY_MS || 1500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Saknar miljövariabeln ${name}. Lägg den i .env.local (se scriptets header för instruktioner).`);
  }
  return v;
}

async function getAccessToken() {
  const clientId = requireEnv("BOLAGSVERKET_CLIENT_ID");
  const clientSecret = requireEnv("BOLAGSVERKET_CLIENT_SECRET");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: SCOPE }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token-hämtning misslyckades (${res.status}): ${text}`);
  }
  const json = JSON.parse(text);
  if (!json.access_token) {
    throw new Error(`Inget access_token i svaret: ${text}`);
  }
  return json.access_token;
}

function normalizeOrgnr(raw) {
  // "559313-8133" -> "5593138133"
  return (raw || "").replace(/[^0-9]/g, "");
}

function pickKlartext(field) {
  return field && !field.fel ? field.klartext ?? field.kod ?? null : null;
}

async function lookupOrganisation(token, orgnrRaw) {
  const identitetsbeteckning = normalizeOrgnr(orgnrRaw);
  const res = await fetch(`${BASE_URL}/organisationer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
    },
    body: JSON.stringify({ identitetsbeteckning }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { status: `http-${res.status}`, error: body.slice(0, 300) };
  }

  const json = await res.json();
  const org = json.organisationer?.[0];
  if (!org) {
    return { status: "not-found" };
  }

  const postadress = org.postadressOrganisation?.postadress;
  const sniList = org.naringsgrenOrganisation?.sni?.filter((s) => s && !s.fel) ?? [];

  return {
    status: "ok",
    bolagsform: pickKlartext(org.organisationsform),
    registreringsdatum: org.organisationsdatum && !org.organisationsdatum.fel ? org.organisationsdatum.registreringsdatum : null,
    aktiv: org.verksamOrganisation && !org.verksamOrganisation.fel ? org.verksamOrganisation.kod === "JA" : null,
    avregistrerad: org.avregistreradOrganisation && !org.avregistreradOrganisation.fel ? org.avregistreradOrganisation.avregistreringsdatum ?? null : null,
    sni: sniList.map((s) => ({ kod: s.kod, klartext: s.klartext })),
    adress: postadress && !org.postadressOrganisation?.fel
      ? {
          utdelningsadress: postadress.utdelningsadress ?? null,
          postnummer: postadress.postnummer ?? null,
          postort: postadress.postort ?? null,
          land: postadress.land ?? null,
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
      if (DELAY_MS > 0) await sleep(DELAY_MS);
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
  const onlyTest = process.argv.includes("--test");
  const retryFailed = process.argv.includes("--retry-failed");
  const { gap } = JSON.parse(await readFile(GAP_PATH, "utf-8"));

  let items = onlyTest ? gap.slice(0, 3) : gap;
  let previousResults = null;

  if (retryFailed) {
    previousResults = JSON.parse(await readFile(OUT_PATH, "utf-8"));
    const failedOrgnrs = new Set(previousResults.members.filter((m) => m.bolagsverket.status !== "ok").map((m) => m.orgnr));
    items = gap.filter((m) => failedOrgnrs.has(m.orgnr));
    console.log(`--retry-failed: ${items.length} tidigare misslyckade av ${previousResults.members.length} totalt.`);
  }

  console.log(`Hämtar access-token från ${TOKEN_URL} ...`);
  const token = await getAccessToken();
  console.log("Token OK.");
  console.log(`Slår upp ${items.length} bolag mot ${BASE_URL} (concurrency ${CONCURRENCY})...`);

  const results = await runWithConcurrency(items, CONCURRENCY, async (member) => {
    try {
      const data = await lookupOrganisation(token, member.orgnr);
      return { ...member, bolagsverket: data };
    } catch (err) {
      return { ...member, bolagsverket: { status: "error", error: err.message } };
    }
  });

  let finalMembers = results;
  if (retryFailed) {
    const retriedByOrgnr = new Map(results.map((r) => [r.orgnr, r]));
    finalMembers = previousResults.members.map((m) => retriedByOrgnr.get(m.orgnr) ?? m);
    const newlyOk = results.filter((r) => r.bolagsverket.status === "ok").length;
    console.log(`\nRetry klart: ${newlyOk}/${items.length} nya lyckades.`);
  } else {
    const ok = results.filter((r) => r.bolagsverket.status === "ok");
    console.log(`\nKlart: ${ok.length}/${results.length} lyckades.`);
  }

  const totalOk = finalMembers.filter((m) => m.bolagsverket.status === "ok").length;
  const firstOk = finalMembers.find((m) => m.bolagsverket.status === "ok");
  if (firstOk) {
    console.log("\nExempel:");
    console.log(JSON.stringify({ name: firstOk.name, orgnr: firstOk.orgnr, bolagsverket: firstOk.bolagsverket }, null, 2));
  }
  console.log(`\nTotalt nu: ${totalOk}/${finalMembers.length} bolag med lyckad Bolagsverket-data.`);

  const outFile = onlyTest ? "./data/gap-bolagsverket-test.json" : OUT_PATH;
  await writeFile(
    new URL(outFile, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, total: finalMembers.length, ok: totalOk, members: finalMembers }, null, 2),
    "utf-8"
  );
  console.log(`Sparat till ${onlyTest ? "scripts/data/gap-bolagsverket-test.json" : "scripts/data/gap-bolagsverket.json"}`);
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
