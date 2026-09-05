#!/usr/bin/env node
// Samlar in vad som går att få fram maskinellt om de största bolagen i registret
// som ännu saknar profil, så att så lite som möjligt behöver skrivas för hand.
//
// Två källor:
//   Bolagsverket — verksamhetsbeskrivningen ur bolagsordningen och SNI-koder.
//     Formellt språk, men säger vad bolaget faktiskt gör, och kommer från
//     bolaget självt.
//   Bolagets hemsida — den enda källan till vilka yrkesområden de rekryterar
//     inom. Sidan hämtas och texten sparas för vidare bedömning.
//
// Körs: node --env-file=.env.local scripts/research-toppbolag.mjs [antal]
// Skriver scripts/data/research-toppbolag.json

import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const UT = new URL("./data/research-toppbolag.json", import.meta.url);
const ANTAL_TOPP = 100;

const BV_BAS = "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
const BV_TOKEN = "https://portal.api.bolagsverket.se/oauth2/token";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const paus = (ms) => new Promise((r) => setTimeout(r, ms));

function omsattningTillTal(text) {
  if (!text) return 0;
  const m = String(text).replace(/\s/g, "").match(/([\d,.]+)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/\./g, "").replace(",", ".")) || 0;
}

async function hamtaRegistret() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Saknar Supabase-uppgifter i miljön");

  const alla = [];
  for (let from = 0; ; from += 1000) {
    const svar = await fetch(
      `${url}/rest/v1/companies?select=id,name,org_number,city,address,revenue,employees,founded,link,contact,vision,description,focus,services&order=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` } }
    );
    const del = await svar.json();
    alla.push(...del);
    if (del.length < 1000) break;
  }
  return alla;
}

let bvToken = null;
async function bolagsverketToken() {
  if (bvToken) return bvToken;
  const id = process.env.BOLAGSVERKET_CLIENT_ID;
  const hemlighet = process.env.BOLAGSVERKET_CLIENT_SECRET;
  if (!id || !hemlighet) return null;

  const svar = await fetch(BV_TOKEN, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${hemlighet}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "vardefulla-datamangder:read" }),
  });
  if (!svar.ok) throw new Error(`Bolagsverket-token misslyckades (${svar.status})`);
  bvToken = (await svar.json()).access_token;
  return bvToken;
}

async function franBolagsverket(orgnr) {
  const token = await bolagsverketToken();
  if (!token) return null;

  const svar = await fetch(`${BV_BAS}/organisationer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
    },
    body: JSON.stringify({ identitetsbeteckning: String(orgnr).replace(/\D/g, "") }),
  });
  if (!svar.ok) return { fel: `http-${svar.status}` };

  const org = (await svar.json()).organisationer?.[0];
  if (!org) return { fel: "ej-hittad" };

  const sni = (org.naringsgrenOrganisation?.sni || [])
    .filter((s) => s?.kod?.trim() && !s.fel)
    .map((s) => `${s.kod.trim()} ${s.klartext}`);

  return {
    verksamhetsbeskrivning: org.verksamhetsbeskrivning?.fel
      ? null
      : (org.verksamhetsbeskrivning?.beskrivning || "").replace(/\s+/g, " ").trim() || null,
    sni,
    bolagsform: org.organisationsform?.klartext || null,
  };
}

// Hämtar startsidan och plockar ut titel, beskrivning och synlig text. Texten är
// råmaterial för att avgöra vilka yrkesområden bolaget rekryterar inom — det
// står ingenstans i något register.
async function franHemsida(adress) {
  if (!adress) return null;
  const url = /^https?:\/\//i.test(adress) ? adress : `https://${adress}`;

  try {
    const svar = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!svar.ok) return { fel: `http-${svar.status}` };

    const html = await svar.text();
    const titel = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null;
    const beskrivning =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || null;

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const mejl = [...html.matchAll(/mailto:([^"'?\s>]+@[^"'?\s>]+)/gi)].map((m) => m[1].toLowerCase());

    return {
      titel,
      beskrivning,
      mejl: [...new Set(mejl)].slice(0, 3),
      text: text.slice(0, 2500),
    };
  } catch (err) {
    return { fel: err.name === "TimeoutError" ? "timeout" : err.message.slice(0, 60) };
  }
}

async function main() {
  const antalAttHamta = Number(process.argv[2]) || Infinity;

  const alla = await hamtaRegistret();
  alla.forEach((b) => (b._oms = omsattningTillTal(b.revenue)));

  const topp = [...alla].sort((a, b) => b._oms - a._oms).slice(0, ANTAL_TOPP);
  const utan = topp.filter((b) => !b.vision).slice(0, antalAttHamta);

  console.log(`${alla.length} bolag i registret, ${utan.length} i topp ${ANTAL_TOPP} saknar profil.\n`);

  const resultat = [];
  for (const [i, bolag] of utan.entries()) {
    const [bv, sida] = await Promise.all([
      bolag.org_number ? franBolagsverket(bolag.org_number).catch((e) => ({ fel: e.message })) : null,
      franHemsida(bolag.link),
    ]);

    resultat.push({ ...bolag, bolagsverket: bv, hemsida: sida });

    const status = [
      bv?.verksamhetsbeskrivning ? "BV" : null,
      sida?.text ? "webb" : null,
      sida?.mejl?.length ? "mejl" : null,
    ].filter(Boolean).join("+") || "inget";
    console.log(`  ${String(i + 1).padStart(2)}/${utan.length}  ${bolag.name.slice(0, 34).padEnd(36)}${status}`);

    // Bolagsverket tillåter 60 anrop i minuten.
    await paus(1100);
  }

  await writeFile(UT, JSON.stringify({ skapad: new Date().toISOString(), bolag: resultat }, null, 2), "utf-8");

  const medBV = resultat.filter((r) => r.bolagsverket?.verksamhetsbeskrivning).length;
  const medWebb = resultat.filter((r) => r.hemsida?.text).length;
  const medMejl = resultat.filter((r) => r.hemsida?.mejl?.length).length;
  console.log(`\n${medBV} med verksamhetsbeskrivning, ${medWebb} med hemsidetext, ${medMejl} med mejladress.`);
  console.log("Sparat till scripts/data/research-toppbolag.json");
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
