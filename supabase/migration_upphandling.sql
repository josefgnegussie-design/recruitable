-- Upphandling: ett bolag lägger ut ett inköp, och leverantörer visar vilka orter
-- och kompetenser de kan täcka.
--
-- Köparna har inga konton, precis som beställarna av förfrågningar. De får en
-- hemlig länk (/upphandling/hantera/<token>) i bekräftelsemejlet, och bara dess
-- SHA-256-hash sparas här. Leverantörerna är verifierade bolagsadmins och
-- anmäler sig på Mina sidor.
--
-- Inga policyer, med flit. RLS kan inte begränsa kolumner, och en läspolicy på
-- procurements hade lämnat ut köparens namn och mejl till var och en med
-- anon-nyckeln (samma läcka som migration_forfragan_sekretess.sql täppte till).
-- Allt läses och skrivs av backend med service role, och där ligger också
-- modereringsgrinden.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.

create table if not exists procurements (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text not null,
  service text not null,
  -- 'privat' eller 'offentlig'. En offentlig köpare får bara föra en
  -- marknadsdialog här: sidan ersätter inte annonsering av upphandlingen.
  buyer_type text not null default 'privat' check (buyer_type in ('privat', 'offentlig')),
  -- Vad leverantörerna ser i stället för namnet, t.ex. "Industribolag, cirka
  -- 1 200 anställda".
  buyer_description text not null,
  -- 'efter_intresse': namnet visas när leverantören anmält sig. 'direkt': alla ser det.
  name_visibility text not null default 'efter_intresse' check (name_visibility in ('efter_intresse', 'direkt')),

  contract_period text,
  volume text,
  cities text[] not null,
  competences text[] not null,
  -- Yrkesområdena ur lib/taxonomy.js. Avgör vilka bolag som får besked.
  focus_areas text[] not null,
  -- [{ id, text, niva: 'ska'|'bor', profil: 'ka'|'ISO 9001'|'ISO 14001'|'auktorisation'|null }]
  requirements jsonb not null default '[]'::jsonb,

  questions_deadline date not null,
  interest_deadline date not null,
  decision_date date not null,
  contract_start date,

  requester_name text not null,
  requester_email text not null,
  requester_website text not null,
  requester_role text not null,
  requester_company text not null,
  requester_city text not null,
  requester_phone text,

  token_hash text not null unique,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists procurements_oppna
  on procurements (interest_deadline)
  where moderation_status = 'approved' and closed_at is null;

create table if not exists procurement_interests (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references procurements(id) on delete cascade,
  company_id integer not null references companies(id) on delete cascade,
  -- [{ ort, kompetens }]
  coverage jsonb not null,
  -- { <krav-id>: { uppfylls: bool, kalla: 'profil'|'bolaget' } }
  requirement_answers jsonb not null default '{}'::jsonb,
  capacity text,
  reference text,
  message text,
  open_to_partner boolean not null default false,
  -- Den som anmälde. Köparen behöver någon att höra av sig till, och
  -- companies.contact är en allmän adress som kan saknas.
  contact_email text not null,
  status text not null default 'anmald' check (status in ('anmald', 'kortlista')),
  decision_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procurement_id, company_id)
);

create index if not exists procurement_interests_bolag on procurement_interests (company_id);

create table if not exists procurement_questions (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references procurements(id) on delete cascade,
  -- Visas aldrig för köparen eller för andra leverantörer. Sparas för att
  -- kunna stoppa missbruk.
  company_id integer references companies(id) on delete set null,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists procurement_questions_upphandling on procurement_questions (procurement_id);

alter table procurements enable row level security;
alter table procurement_interests enable row level security;
alter table procurement_questions enable row level security;

revoke all on procurements, procurement_interests, procurement_questions from anon, authenticated;
grant all on procurements, procurement_interests, procurement_questions to service_role;

notify pgrst, 'reload schema';
