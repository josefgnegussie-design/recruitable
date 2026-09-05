#!/usr/bin/env node
// Hämtar Bolagsverkets verksamhetsbeskrivning och SNI-koder för samtliga bolag i
// registret som saknar dem.
//
// Beskrivningen kommer ur bolagsordningen och säger i formella ordalag vad
// bolaget faktiskt gör — "bedriva rekrytering och uthyrning av personal inom
// vård och omsorg". Det är vida bättre underlag för att avgöra yrkesområde än
// bolagsnamnet, som bara gav 2,3 procent täckning.
//
// Bolagsverket tillåter 60 anrop i minuten, så hela registret tar drygt en
// timme. Kan avbrytas och köras om: redan hämtade bolag hoppas över.
//
// Körs: node --env-file=.env.local scripts/hamta-verksamhetsbeskrivningar.mjs [antal]

import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const UT = new URL("./data/verksamhetsbeskrivningar.json", import.meta.url);
const BAS = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
const TOKEN_URL = "https://portal.api.bolagsverket.se/oauth2/token";

const paus = (ms) => new Promise((r) => setTimeout(r, ms));

async function hamtaRegistret() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Saknar Supabase-uppgifter i miljön");

  const alla = [];
  for (let from = 0; ; from += 1000) {
    const svar = await fetch(
      `${url}/rest/v1/companies?select=id,name,org_number,vision,focus,services&order=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } }
    );
    const del = await svar.json();
    alla.push(...del);
    if (del.length < 1000) break;
  }
  return alla;
}

let token = null;
let tokenUtgar = 0;
async function hamtaToken() {
  if (token && tokenUtgar > Date.now()) return token;

  const id = process.env.BOLAGSVERKET_CLIENT_ID;
  const hemlighet = process.env.BOLAGSVERKET_CLIENT_SECRET;
  if (!id || !hemlighet) throw new Error("Saknar Bolagsverket-uppgifter i miljön");

  const svar = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${hemlighet}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "vardefulla-datamangder:read" }),
  });
  if (!svar.ok) throw new Error(`Token misslyckades (${svar.status})`);

  const json = await svar.json();
  token = json.access_token;
  tokenUtgar = Date.now() + Math.max(30, Number(json.expires_in || 600) - 60) * 1000;
  return token;
}

async function slaUpp(orgnr) {
  const svar = await fetch(`${BAS}/organisationer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await hamtaToken()}`,
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
    },
    body: JSON.stringify({ identitetsbeteckning: String(orgnr).replace(/\D/g, "") }),
  });

  if (svar.status === 429) return { fel: "for-manga-anrop" };
  if (!svar.ok) return { fel: `http-${svar.status}` };

  const org = (await svar.json()).organisationer?.[0];
  if (!org) return { fel: "ej-hittad" };

  return {
    beskrivning: org.verksamhetsbeskrivning?.fel
      ? null
      : (org.verksamhetsbeskrivning?.beskrivning || "").replace(/\s+/g, " ").trim() || null,
    sni: (org.naringsgrenOrganisation?.sni || [])
      .filter((s) => s?.kod?.trim() && !s.fel)
      .map((s) => `${s.kod.trim()} ${s.klartext}`),
    aktiv: org.verksamOrganisation?.fel ? null : org.verksamOrganisation?.kod === "JA",
  };
}

async function main() {
  const tak = Number(process.argv[2]) || Infinity;

  let redan = {};
  try {
    redan = JSON.parse(await readFile(UT, "utf-8")).bolag || {};
    console.log(`${Object.keys(redan).length} bolag redan hämtade sedan tidigare.`);
  } catch {
    // Första körningen.
  }

  const alla = await hamtaRegistret();
  const kvar = alla.filter((b) => b.org_number && !redan[b.id]).slice(0, tak);

  console.log(`${alla.length} bolag i registret, ${kvar.length} kvar att hämta.\n`);

  let lyckade = 0;
  let misslyckade = 0;

  for (const [i, bolag] of kvar.entries()) {
    try {
      const svar = await slaUpp(bolag.org_number);
      redan[bolag.id] = { namn: bolag.name, ...svar };
      if (svar.beskrivning) lyckade++;
      else misslyckade++;
    } catch (err) {
      redan[bolag.id] = { namn: bolag.name, fel: err.message.slice(0, 60) };
      misslyckade++;
    }

    const gjorda = i + 1;
    if (gjorda % 100 === 0 || gjorda === kvar.length) {
      await writeFile(UT, JSON.stringify({ uppdaterad: new Date().toISOString(), bolag: redan }, null, 1), "utf-8");
      const kvarTid = Math.round(((kvar.length - gjorda) * 1.05) / 60);
      console.log(`  ${gjorda}/${kvar.length}  (${lyckade} med beskrivning, ${misslyckade} utan) — ca ${kvarTid} min kvar`);
    }

    await paus(1050);
  }

  await writeFile(UT, JSON.stringify({ uppdaterad: new Date().toISOString(), bolag: redan }, null, 1), "utf-8");
  console.log(`\nKlart. ${lyckade} med beskrivning, ${misslyckade} utan.`);
  console.log("Sparat till scripts/data/verksamhetsbeskrivningar.json");
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
