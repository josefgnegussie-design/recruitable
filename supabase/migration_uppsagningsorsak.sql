-- Skälet ett bolag anger när de säger upp sin prenumeration.
--
-- Sparas hos oss och inte bara hos Stripe: Stripe känner abonnemanget, inte
-- bolaget, och frågan vi vill kunna svara på är om bolagen lämnar för att de
-- får för få förfrågningar eller för att de får fel sorts förfrågningar. Det
-- ena lagas med fler kunder, det andra med bättre matchning.
--
-- Raden överlever att bolaget kommer tillbaka och säger upp igen — varje
-- uppsägning är sin egen rad, med sina egna siffror i samma ögonblick.

create table if not exists cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id integer not null references companies(id) on delete cascade,
  user_id uuid,
  -- Ett av värdena i lib/uppsagning.js. Ingen fritext: se kommentaren där.
  reason text not null,
  -- Vad bolaget faktiskt fått ut, som det såg ut när de sa upp. Sparas som tal
  -- och inte räknas fram i efterhand — förfrågningar kan raderas, och då hade
  -- historiken skrivit om sig själv.
  forfragningar_90d integer,
  accepterade_90d integer,
  created_at timestamptz not null default now()
);

-- Fritext, och bara för skälet "annat" — se lib/uppsagning.js. Egen sats så
-- att den går att köra på en tabell som redan finns.
alter table cancellation_feedback add column if not exists reason_text text;

create index if not exists cancellation_feedback_company_idx
  on cancellation_feedback (company_id, created_at desc);

alter table cancellation_feedback enable row level security;

-- Inga policyer: tabellen skrivs och läses bara med service role-nyckeln, som
-- inquiries. Bolaget ska inte kunna läsa andras skäl, och behöver inte läsa
-- sina egna.
