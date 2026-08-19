#!/usr/bin/env node
// Läser alla migrationer i supabase/ och genererar en granskningsfråga som visar
// vilka tabeller och kolumner databasen saknar jämfört med vad migrationerna
// förväntar sig.
//
// Bakgrund: 2026-08-19 visade det sig att migration_signup_claim.sql aldrig körts
// mot produktionsdatabasen, vilket gjorde att registreringen aldrig kunde slutföras
// (PGRST204 på claimed_address). Felet upptäcktes av en slump. Den här frågan gör
// samma kontroll för allt på en gång.
//
// Körs: node scripts/bygg-schemagranskning.mjs
// Resultatet klistras in i Supabase → SQL Editor.

import { readdir, readFile, writeFile } from "node:fs/promises";

const SUPABASE_DIR = new URL("../supabase/", import.meta.url);

function q(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const filer = (await readdir(SUPABASE_DIR)).filter((f) => f.endsWith(".sql"));

  const kolumner = new Set();
  const tabeller = new Set();

  for (const fil of filer) {
    // Kommentarer bort och all blankrad ihop, så att ALTER-satser som sträcker sig
    // över flera rader fångas lika bra som de enradiga.
    const text = (await readFile(new URL(fil, SUPABASE_DIR), "utf-8"))
      .replace(/--[^\n]*/g, "")
      .replace(/\s+/g, " ");

    const kolumnRe = /alter table (?:public\.)?([a-z_]+) add column (?:if not exists )?([a-z_]+)/gi;
    for (const m of text.matchAll(kolumnRe)) kolumner.add(`${m[1]}|${m[2]}`);

    const tabellRe = /create table (?:if not exists )?(?:public\.)?([a-z_]+)/gi;
    for (const m of text.matchAll(tabellRe)) tabeller.add(m[1]);
  }

  const tabellRader = [...tabeller].sort().map((t) => `    (${q(t)})`);
  const kolumnRader = [...kolumner].sort().map((rad) => {
    const [tabell, kolumn] = rad.split("|");
    return `    (${q(tabell)}, ${q(kolumn)})`;
  });

  const sql = `-- Granskning: vad migrationerna i supabase/ förväntar sig, jämfört med
-- vad databasen faktiskt innehåller. Läser bara metadata och ändrar ingenting.
--
-- Genererad av scripts/bygg-schemagranskning.mjs — kör om det scriptet när nya
-- migrationer tillkommit.

with forvantade_tabeller(tabell) as (
  values
${tabellRader.join(",\n")}
),
forvantade_kolumner(tabell, kolumn) as (
  values
${kolumnRader.join(",\n")}
)
select
  'tabell' as typ,
  t.tabell as objekt,
  '' as kolumn,
  case when x.table_name is null then 'SAKNAS' else 'ok' end as status
from forvantade_tabeller t
left join information_schema.tables x
  on x.table_schema = 'public' and x.table_name = t.tabell
union all
select
  'kolumn',
  k.tabell,
  k.kolumn,
  case when c.column_name is null then 'SAKNAS' else 'ok' end
from forvantade_kolumner k
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = k.tabell
 and c.column_name = k.kolumn
order by status desc, typ, objekt, kolumn;
`;

  await writeFile(new URL("granska_schema.sql", SUPABASE_DIR), sql, "utf-8");
  console.log(`${tabeller.size} tabeller och ${kolumner.size} kolumner att kontrollera.`);
  console.log("Sparat till supabase/granska_schema.sql");
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
