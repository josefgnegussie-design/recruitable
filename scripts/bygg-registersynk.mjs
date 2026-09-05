#!/usr/bin/env node
// Genererar SQL som får companies-tabellen att innehålla allt som finns i den
// statiska lib/companies.js — utan att skriva över något som bolagen själva
// lagt in via portalen.
//
// Två saker görs, båda ofarliga att köra om:
//
//   1. Bolag som saknas i tabellen läggs till. Redan befintliga rader lämnas
//      orörda ("on conflict do nothing"), så en uppladdad logga eller en betald
//      premiumprofil kan aldrig skrivas över av den här körningen.
//
//   2. office_cities fylls i, men bara där kolumnen är tom. Fältet fanns bara i
//      den statiska filen och kom därför inte med i den ursprungliga importen —
//      utan det tappar varje bolag med flera kontor sin ortslista på profilen.
//
// Körs: node scripts/bygg-registersynk.mjs
// Resultatet klistras in i Supabase → SQL Editor.

import { readFile, writeFile } from "node:fs/promises";

const KALLA = new URL("../lib/companies.js", import.meta.url);
const MAL = new URL("../supabase/synka_register.sql", import.meta.url);

// lib/companies.js är ren ESM utan beroenden, och projektet saknar
// "type": "module" — därför läses den som text i stället för att importeras.
async function lasCompanies() {
  const kod = await readFile(KALLA, "utf-8");
  const fabrik = new Function(`${kod.replace("export const", "const")}; return COMPANIES;`);
  return fabrik();
}

function str(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function num(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "null" : String(value);
}

function bool(value) {
  return value ? "true" : "false";
}

function arr(values) {
  if (!Array.isArray(values) || values.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${values.map((v) => str(v)).join(",")}]`;
}

async function main() {
  const bolag = await lasCompanies();

  const insertRader = bolag.map(
    (c) =>
      `  (${num(c.id)}, ${str(c.name)}, ${str(c.city)}, ${str(c.address)}, ${arr(c.officeCities)}, ` +
      `${num(c.lat)}, ${num(c.lng)}, ${arr(c.auktorisation)}, ${arr(c.focus)}, ${arr(c.services)}, ` +
      `${str(c.sizeBand)}, ${bool(c.ka)}, ${num(c.founded)}, ${str(c.revenue)}, ${num(c.revenueYear)}, ` +
      `${str(c.employees)}, ${num(c.employeesYear)}, ${num(c.rating)}, ${num(c.ratingCount)}, ` +
      `${str(c.vision)}, ${str(c.desc)}, ${str(c.contact)}, ${str(c.link)}, ${str(c.logo)})`
  );

  const ortRader = bolag.map((c) => `  (${num(c.id)}, ${arr(c.officeCities)})`);

  const sql = `-- Synkar companies-tabellen med lib/companies.js.
-- Genererad av scripts/bygg-registersynk.mjs — kör om scriptet när filen ändrats.
--
-- Säker att köra om: befintliga rader lämnas orörda, och office_cities fylls
-- bara i där den är tom. Ingenting som ett bolag själv lagt in kan skrivas över.

-- 1. Lägg till de bolag som saknas.
insert into companies (
  id, name, city, address, office_cities, lat, lng, auktorisation, focus, services,
  size_band, ka, founded, revenue, revenue_year, employees, employees_year,
  rating, rating_count, vision, description, contact, link, logo
) values
${insertRader.join(",\n")}
on conflict (id) do nothing;

-- 2. Fyll i orterna där de saknas.
update companies
set office_cities = v.orter
from (values
${ortRader.join(",\n")}
) as v(id, orter)
where companies.id = v.id
  and companies.office_cities = '{}'
  and array_length(v.orter, 1) is not null;

-- 3. Se efter att allt kom med.
select count(*) as antal_bolag,
       count(*) filter (where office_cities <> '{}') as med_orter
from companies;

notify pgrst, 'reload schema';
`;

  await writeFile(MAL, sql, "utf-8");
  const medOrter = bolag.filter((c) => c.officeCities?.length).length;
  console.log(`${bolag.length} bolag i filen, varav ${medOrter} har ortslista.`);
  console.log("Sparat till supabase/synka_register.sql");
}

main().catch((err) => {
  console.error("Misslyckades:", err.message);
  process.exit(1);
});
