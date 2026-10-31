#!/usr/bin/env node
// Visar vad nyhetsjobbet skulle släppa igenom just nu och vad det sållar bort.
// Skriver ingenting till databasen.
//
// Körs: node scripts/provkor-branschnyheter.mjs

import { KALLOR, arRelevant, hamtaKalla } from "../lib/branschnyheter.js";

for (const kalla of KALLOR) {
  const { rader, fel } = await hamtaKalla(kalla);
  console.log(`\n=== ${kalla.namn} (${rader.length})${fel ? ` FEL: ${fel}` : ""}`);
  for (const r of rader) {
    console.log(`${arRelevant(r.titel, kalla) ? "JA " : " - "} ${r.publicerad_at.slice(0, 10)} ${r.titel}`);
  }
}
