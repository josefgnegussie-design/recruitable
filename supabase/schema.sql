-- Recruitable — databasschema
-- Kör detta i Supabase: Project → SQL Editor → New query → klistra in → Run.

-- ============================================================
-- TABELL: companies
-- Motsvarar dagens lib/companies.js, men som en levande databastabell.
-- id är samma heltal som redan används i /bolag/[id]-länkarna, så
-- befintliga länkar fortsätter fungera när vi migrerar över datan.
-- ============================================================
create table if not exists companies (
  id integer primary key,
  name text not null,
  city text not null,
  address text not null,
  lat double precision,
  lng double precision,
  auktorisation text[] not null default '{}',
  focus text[] not null default '{}',
  services text[] not null default '{}',
  size_band text check (size_band in ('Litet', 'Medel', 'Stort')),
  ka boolean not null default false,
  founded integer,
  revenue text,
  revenue_year integer,
  employees text,
  employees_year integer,
  rating numeric(2,1),
  rating_count integer,
  vision text,
  description text,
  contact text,
  link text,
  logo text,

  -- Premium/prenumeration (bolaget betalar 399 kr/mån)
  is_premium boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  premium_since timestamptz,

  -- Utökad profil — bara relevant/synlig när is_premium = true.
  -- Detta är bolagets EGEN presentation, tydligt avskild i gränssnittet
  -- från de objektiva fälten ovan (se resonemanget i Om oss-sidans FAQ).
  extended_vision text,
  team_members jsonb not null default '[]',   -- [{ name, role, photo_url }]
  surveys jsonb not null default '{}',         -- fritt format, t.ex. { employee_satisfaction: 4.5 }

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TABELL: company_admins
-- Kopplar en inloggad Supabase-användare (auth.users, hanteras
-- automatiskt av Supabase Auth) till det bolag hen får administrera.
-- En rad = en person med adminrättigheter för ett bolag.
-- "verified" är den manuella godkännande-flaggan vi kom överens om:
-- e-postdomänen måste matcha bolagets kända hemsida OCH en människa
-- (Josef) godkänner kontot innan det aktiveras.
-- ============================================================
create table if not exists company_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id integer not null references companies(id) on delete cascade,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Detta är databasens egen säkerhetsspärr — gäller även om det
-- skulle finnas en bugg i applikationskoden.
-- ============================================================
alter table companies enable row level security;
alter table company_admins enable row level security;

-- Alla (även utloggade besökare) får LÄSA bolagsdata — det är hela
-- poängen med registret, det ska vara öppet och jämförbart för alla.
create policy "Publik läsåtkomst till bolag"
  on companies for select
  using (true);

-- Endast en verifierad admin för just det bolaget får ÄNDRA det.
-- OBS: vilka enskilda FÄLT som faktiskt går att ändra (t.ex. inte
-- "rating" eller "is_premium") styrs inte här utan i API-koden,
-- som bara tillåter skrivning till de fält som hör till premium-profilen.
create policy "Verifierad admin kan uppdatera sitt eget bolag"
  on companies for update
  using (
    exists (
      select 1 from company_admins
      where company_admins.company_id = companies.id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );

-- En användare får se sina egna adminkopplingar, men inte andras.
create policy "Användare ser sina egna adminrader"
  on company_admins for select
  using (user_id = auth.uid());

-- Inga insert/update/delete-policyer för vanliga inloggade användare
-- på company_admins — nya kopplingar skapas bara via backend (service
-- role-nyckeln), som en del av det manuella godkännandeflödet.
