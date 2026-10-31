-- ============================================================
-- Branschnyheter — startsidans "Från branschen"
-- Fylls varje morgon av /api/cron/branschnyheter. Bara rubrik, källa,
-- datum och länk sparas, aldrig artikeltext.
--
-- titel_nyckel är rubriken normaliserad och fungerar som dubblettskydd:
-- samma rubrik sparas en gång, även om den dyker upp i två flöden.
--
-- En olämplig nyhet tas bort från startsidan med:
--   update branschnyheter set dold = true where url = '...';
-- Raden ska ligga kvar. Tas den bort hämtas den in igen nästa morgon.
-- ============================================================
create table if not exists branschnyheter (
  id bigint generated always as identity primary key,
  titel text not null,
  titel_nyckel text not null unique,
  kalla text not null,
  url text not null,
  publicerad_at timestamptz not null,
  hamtad_at timestamptz not null default now(),
  dold boolean not null default false
);

create index if not exists branschnyheter_publicerad_idx on branschnyheter (publicerad_at desc);

alter table branschnyheter enable row level security;

-- Policyn räcker inte: projektet ger inte nya tabeller rättigheter automatiskt,
-- och utan grant svarar anon "permission denied" (42501).
grant select on branschnyheter to anon, authenticated;
grant all on branschnyheter to service_role;

-- Startsidan läser med anon-nyckeln. Skrivningar går bara via service role.
drop policy if exists "Branschnyheter är publika" on branschnyheter;
create policy "Branschnyheter är publika"
  on branschnyheter for select
  to anon, authenticated
  using (not dold);
