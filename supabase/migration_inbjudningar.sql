-- Inbjudan av kollegor till ett bolagskonto.
--
-- Bakgrund: ägaren kunde bara lägga till en kollega som redan registrerat ett
-- eget konto, och registreringen hamnade då i granskningskön först. En
-- inbjudan går i stället ut som ett mejl med en engångslänk; den som klickar
-- kopplas direkt som verifierad administratör för bolaget.
--
-- Länken bär en slumpad token (32 byte). Bara dess SHA-256-hash sparas här,
-- så att en läckt kopia av tabellen inte går att använda för att ta sig in.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.

create table if not exists bolagsinbjudningar (
  id uuid primary key default gen_random_uuid(),
  company_id integer not null references companies(id) on delete cascade,
  -- Alltid gemener. Jämförs mot adressen på kontot som löser in inbjudan.
  epost text not null,
  token_hash text not null unique,
  inbjuden_av uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  giltig_till timestamptz not null default (now() + interval '7 days'),
  antagen_at timestamptz,
  aterkallad_at timestamptz
);

-- Högst en öppen inbjudan per adress och bolag. En ny inbjudan till samma
-- adress återkallar den förra i koden innan den skapas.
create unique index if not exists bolagsinbjudningar_en_oppen
  on bolagsinbjudningar (company_id, epost)
  where antagen_at is null and aterkallad_at is null;

alter table bolagsinbjudningar enable row level security;

-- Medvetet utan policyer: inbjudningar skapas, listas och löses in bara via
-- backend med service role-nyckeln, efter att ägarskapet kontrollerats där.
revoke all on bolagsinbjudningar from anon, authenticated;
grant all on bolagsinbjudningar to service_role;

notify pgrst, 'reload schema';
