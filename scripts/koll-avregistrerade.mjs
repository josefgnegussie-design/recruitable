#!/usr/bin/env node
// Går igenom hela registret mot Bolagsverket och letar avregistrerade bolag.
//
// Varför både det här och /api/cron/bolagsverket-koll: Bolagsverket slår upp ETT
// organisationsnummer per anrop (en lista ger 400) och tillåter 60 anrop i
// minuten. En serverlös funktion hinner därför ~40 bolag innan den dödas, och ett
// register på 3 770 bolag skulle ta tre månader att beta av med en daglig körning.
// Det här skriptet gör första svepet på en dryg timme; cron-jobbet sköter sedan
// underhållet, bolag för bolag i tur och ordning.
//
// Skriptet SKRIVER INTE till databasen. Det läser registret med den publika
// nyckeln och lämnar ifrån sig två filer: en CSV att granska, och en SQL-fil att
// köra i Supabase när granskningen är gjord. Samma ordning som
// bygg-koordinater.mjs — ingenting ändras i produktion utan att någon sett det
// först.
//
// Körs: node scripts/koll-avregistrerade.mjs [--antal 500]
// Avbrott går bra: läget sparas löpande och nästa körning fortsätter där den slutade.
//
// Kräver i miljön (eller .env.local): NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, BOLAGSVERKET_CLIENT_ID, BOLAGSVERKET_CLIENT_SECRET.
// Förutsätter att supabase/migration_sammanslagning.sql är körd.

import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const LAGE = new URL("./data/avregistrerade-lage.json", import.meta.url);
const UT_CSV = new URL("./data/avregistrerade.csv", import.meta.url);
const UT_SQL = new URL("../supabase/satt_avregistrering.sql", import.meta.url);

const PAUS_MS = 1100;
const SIDSTORLEK = 1000;

const TOKEN_URL = "https://portal.api.bolagsverket.se/oauth2/token";
const BASE_URL = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";

const paus = (ms) => new Promise((r) => setTimeout(r, ms));

async function lasEnv() {
  const env = { ...process.env };
  try {
    const text = await readFile(new URL("../.env.local", import.meta.url), "utf-8");
    for (const rad of text.split(/\r?\n/)) {
      if (!rad.includes("=") || rad.trim().startsWith("#")) continue;
      const i = rad.indexOf("=");
      const nyckel = rad.slice(0, i).trim();
      // Miljön vinner över filen, så en körning går att styra utan att redigera den.
      if (!env[nyckel]) env[nyckel] = rad.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Ingen .env.local — då måste allt ligga i miljön.
  }
  return env;
}

async function lasRegistret(env) {
  const bolag = [];
  for (let fran = 0; ; fran += SIDSTORLEK) {
    const url =
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/companies` +
      `?select=id,name,org_number&org_number=not.is.null&retired_at=is.null&order=id.asc`;

    const res = await fetch(url, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        Range: `${fran}-${fran + SIDSTORLEK - 1}`,
      },
    });

    if (!res.ok) throw new Error(`Kunde inte läsa registret: HTTP ${res.status} ${await res.text()}`);

    const sida = await res.json();
    bolag.push(...sida);
    if (sida.length < SIDSTORLEK) break;
  }
  return bolag;
}

let token = null;
async function hamtaToken(env) {
  if (token && token.gar_ut > Date.now()) return token.varde;

  const basic = Buffer.from(
    `${env.BOLAGSVERKET_CLIENT_ID}:${env.BOLAGSVERKET_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "vardefulla-datamangder:read" }),
  });

  if (!res.ok) throw new Error(`Token-hämtning misslyckades (${res.status})`);
  const json = await res.json();
  token = { varde: json.access_token, gar_ut: Date.now() + Math.max(30, (json.expires_in || 600) - 60) * 1000 };
  return token.varde;
}

// Tre försök med växande paus. Ett svep över 3 700 bolag möter förr eller senare
// ett "fetch failed" som inte har med bolaget att göra — vid första svepet
// 2026-09-13 föll sex uppslag så, och alla sex svarade HTTP 200 när de provades
// om en stund senare. Utan omförsöken stannar körningen på en blinkning.
async function medOmforsok(fn) {
  let sisteFel;
  for (let forsok = 0; forsok < 3; forsok++) {
    if (forsok > 0) await paus(forsok * 2000);
    try {
      return await fn();
    } catch (err) {
      sisteFel = err;
    }
  }
  throw sisteFel;
}

async function slaUpp(env, orgnr) {
  const siffror = String(orgnr || "").replace(/\D/g, "");
  if (siffror.length !== 10) return { status: "ogiltigt-orgnr" };

  const res = await medOmforsok(async () => {
    const svar = await fetch(`${BASE_URL}/organisationer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await hamtaToken(env)}`,
        "Content-Type": "application/json",
        "X-Request-Id": randomUUID(),
      },
      body: JSON.stringify({ identitetsbeteckning: siffror }),
    });

    // 5xx är serverns dåliga dag och kan gå över; 4xx är vår begäran och blir
    // inte bättre av att skickas igen.
    if (svar.status >= 500) throw new Error(`HTTP ${svar.status}`);
    return svar;
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const org = (await res.json()).organisationer?.[0];
  if (!org) return { status: "ej-hittad" };

  const avreg = org.avregistreradOrganisation?.fel ? null : org.avregistreradOrganisation;

  return {
    status: "ok",
    avregistreringsdatum: avreg?.avregistreringsdatum || null,
    aktiv: org.verksamOrganisation?.fel ? null : org.verksamOrganisation?.kod === "JA",
  };
}

function csvFalt(varde) {
  const text = varde == null ? "" : String(varde);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function sparaResultat(rader) {
  await writeFile(LAGE, JSON.stringify(rader, null, 2), "utf-8");

  const avregistrerade = Object.values(rader).filter((r) => r.avregistreringsdatum);

  const rubriker = ["id", "namn", "orgnr", "avregistreringsdatum", "aktiv", "status"];
  const csv = [
    rubriker.join(","),
    ...Object.values(rader)
      .filter((r) => r.avregistreringsdatum || r.status !== "ok")
      .map((r) =>
        [r.id, r.namn, r.orgnr, r.avregistreringsdatum, r.aktiv, r.status].map(csvFalt).join(",")
      ),
  ].join("\n");
  // BOM, annars öppnar Excel svenska tecken fel.
  await writeFile(UT_CSV, `﻿${csv}`, "utf-8");

  const satser = Object.values(rader)
    .filter((r) => r.status === "ok")
    .map(
      (r) =>
        `update companies set bolagsverket_checked_at = now(), deregistered_at = ${
          r.avregistreringsdatum ? `'${r.avregistreringsdatum}'` : "null"
        }, bolagsverket_active = ${r.aktiv === null ? "null" : r.aktiv} where id = ${r.id};`
    );

  const sql = `-- Registerläget hos Bolagsverket, hämtat av scripts/koll-avregistrerade.mjs.
-- Genererad ${new Date().toISOString().slice(0, 10)}. Kör i Supabase SQL Editor.
--
-- Skriver bara UPPGIFTER: när bolaget kontrollerades, och avregistreringsdatum
-- där det finns ett. Ingenting döljs — vad som ska hända med korten avgörs på
-- /admin/sammanslagningar, där varje avregistrerat bolag dyker upp som ett ärende.
--
-- ${avregistrerade.length} av ${Object.keys(rader).length} kontrollerade bolag är avregistrerade.

${satser.join("\n")}
`;
  await writeFile(UT_SQL, sql, "utf-8");
}

async function main() {
  const env = await lasEnv();

  for (const nyckel of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "BOLAGSVERKET_CLIENT_ID",
    "BOLAGSVERKET_CLIENT_SECRET",
  ]) {
    if (!env[nyckel] || env[nyckel].includes("SENSITIVE")) {
      console.error(`${nyckel} saknas i miljön och i .env.local.`);
      process.exit(1);
    }
  }

  const takIndex = process.argv.indexOf("--antal");
  const tak = takIndex > -1 ? Number(process.argv[takIndex + 1]) : Infinity;

  let rader = {};
  try {
    rader = JSON.parse(await readFile(LAGE, "utf-8"));
    console.log(`Fortsätter — ${Object.keys(rader).length} bolag är redan kontrollerade.`);
  } catch {
    console.log("Ny körning.");
  }

  const bolag = await lasRegistret(env);
  const kvar = bolag.filter((b) => !rader[b.id]);
  console.log(`${bolag.length} bolag med organisationsnummer, ${kvar.length} kvar att kontrollera.`);

  let gjorda = 0;
  let felIRad = 0;

  for (const b of kvar) {
    if (gjorda >= tak) break;

    try {
      const svar = await slaUpp(env, b.org_number);
      felIRad = 0;
      rader[b.id] = {
        id: b.id,
        namn: b.name,
        orgnr: b.org_number,
        status: svar.status,
        avregistreringsdatum: svar.avregistreringsdatum ?? null,
        aktiv: svar.aktiv ?? null,
      };
      if (svar.avregistreringsdatum) {
        console.log(`  AVREGISTRERAT ${b.name} (${b.org_number}) — ${svar.avregistreringsdatum}`);
      }
    } catch (err) {
      felIRad++;
      console.error(`  fel på ${b.name} (${b.org_number}): ${err.message}`);
      // Fem i rad är inte fem trasiga bolag — det är API:et som inte svarar.
      // Då är det bättre att sluta än att bränna resten av registret på fel.
      if (felIRad >= 5) {
        console.error("Fem uppslag i rad misslyckades — avbryter. Kör om senare, läget är sparat.");
        break;
      }
    }

    gjorda++;
    if (gjorda % 25 === 0) {
      await sparaResultat(rader);
      console.log(`  ${gjorda} av ${kvar.length}…`);
    }
    await paus(PAUS_MS);
  }

  await sparaResultat(rader);

  const avreg = Object.values(rader).filter((r) => r.avregistreringsdatum).length;
  console.log(`\nKlart. ${Object.keys(rader).length} kontrollerade, ${avreg} avregistrerade.`);
  console.log("Granska scripts/data/avregistrerade.csv, kör sedan supabase/satt_avregistrering.sql.");
}

main().catch((err) => {
  console.error(err.message);
  if (/column companies\.\w+ does not exist/.test(err.message)) {
    console.error("Kör supabase/migration_sammanslagning.sql i Supabase SQL Editor först.");
  }
  // exitCode och inte process.exit: annars avslutas Node med öppna handtag kvar,
  // och Windows skriver en assertion från libuv efter felmeddelandet.
  process.exitCode = 1;
});
