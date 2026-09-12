#!/usr/bin/env node
// Fyller i companies.slug för alla bolag som saknar den.
//
// Använder samma slugga()/unikSlug() som resten av koden, så ett bolag som
// backfylls här och ett som skapas vid ett godkännande får sin adress efter
// samma regler.
//
// Kräver att supabase/migration_slug.sql körts först.
//
// Körs:
//   node scripts/bygg-slugar.mjs            — visar vad som skulle skrivas
//   node scripts/bygg-slugar.mjs --skriv    — skriver till databasen
//
// Torrkörning är förval med flit: det här rör tusentals rader i produktion, och
// resultatet ska gå att läsa igenom innan det verkställs.

import { readFile, writeFile } from "node:fs/promises";
import { slugga, unikSlug } from "../lib/slug.js";

const SKRIV = process.argv.includes("--skriv");
const UT_CSV = new URL("./data/slugar.csv", import.meta.url);

async function env() {
  const text = await readFile(new URL("../.env.local", import.meta.url), "utf-8");
  const rader = Object.fromEntries(
    text
      .split("\n")
      .filter((r) => r.includes("="))
      .map((r) => [r.slice(0, r.indexOf("=")).trim(), r.slice(r.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
  );
  return { url: rader.NEXT_PUBLIC_SUPABASE_URL, nyckel: rader.SUPABASE_SERVICE_ROLE_KEY };
}

async function main() {
  const { url, nyckel } = await env();
  if (!url || !nyckel) throw new Error("NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY saknas");
  const h = { apikey: nyckel, Authorization: `Bearer ${nyckel}`, "Content-Type": "application/json" };

  // Hela registret, sidvis — PostgREST lämnar aldrig ut mer än tusen rader.
  let bolag = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/companies?select=id,name,slug&order=id&limit=1000&offset=${from}`, { headers: h });
    if (!res.ok) throw new Error(`Kunde inte läsa bolagen (${res.status})`);
    const sida = await res.json();
    bolag = bolag.concat(sida);
    if (sida.length < 1000) break;
  }

  const upptagna = new Set(bolag.map((b) => b.slug).filter(Boolean));
  const attSkriva = [];

  for (const b of bolag) {
    if (b.slug) continue;
    const slug = unikSlug(b.name, upptagna, b.id);
    upptagna.add(slug);
    attSkriva.push({ id: b.id, name: b.name, slug, rak: slugga(b.name) });
  }

  const medSiffra = attSkriva.filter((r) => r.slug !== r.rak);

  console.log(`bolag totalt      : ${bolag.length}`);
  console.log(`har redan slug    : ${bolag.length - attSkriva.length}`);
  console.log(`att fylla i       : ${attSkriva.length}`);
  console.log(`varav med siffra  : ${medSiffra.length}${medSiffra.length ? " (krock, se CSV)" : ""}`);
  console.log(`exempel           : ${attSkriva.slice(0, 3).map((r) => `${r.name} -> ${r.slug}`).join(" | ")}`);

  const csv = ["id,namn,slug", ...attSkriva.map((r) => `${r.id},"${r.name.replace(/"/g, '""')}",${r.slug}`)].join("\n");
  await writeFile(UT_CSV, csv, "utf-8");
  console.log(`\nHela listan: scripts/data/slugar.csv`);

  if (!SKRIV) {
    console.log("\nTorrkörning — ingenting skrivet. Kör med --skriv när listan ser rätt ut.");
    return;
  }

  // En rad i taget vore tusentals anrop. PostgREST kan uppdatera flera rader i
  // ett anrop via upsert, så länge primärnyckeln följer med.
  const STORLEK = 500;
  let skrivna = 0;
  for (let i = 0; i < attSkriva.length; i += STORLEK) {
    const grupp = attSkriva.slice(i, i + STORLEK).map((r) => ({ id: r.id, slug: r.slug }));
    const res = await fetch(`${url}/rest/v1/companies?on_conflict=id`, {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(grupp),
    });
    if (!res.ok) throw new Error(`Skrivningen misslyckades vid rad ${i}: ${res.status} ${await res.text()}`);
    skrivna += grupp.length;
    console.log(`  skrivet ${skrivna}/${attSkriva.length}`);
  }

  console.log("Klart.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
