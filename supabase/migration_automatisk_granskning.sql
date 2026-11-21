-- Automatisk granskning av förfrågningar och upphandlingsinbjudningar.
--
-- Förut stannade allt i /admin/moderera-forfragningar tills någon på
-- Recruitable godkände det. Nu:
--
--   1. Förfrågan sparas som 'unconfirmed' och avsändaren får ett mejl med en
--      bekräftelseknapp. Ingen ser den, inte ens i granskningskön.
--   2. När avsändaren bekräftar körs kontrollerna i lib/automatiskGranskning.js.
--      Utan anmärkning blir den 'approved' direkt och bolagen mejlas, precis
--      som vid ett manuellt godkännande. Med anmärkning blir den 'pending' och
--      hamnar i kön med orsakerna utskrivna, och Recruitable får en notis.
--   3. En godkänd förfrågan kan dras tillbaka i efterhand. Den blir då
--      'rejected' och försvinner ur bolagens Mina sidor (RLS kräver 'approved').
--
-- RLS-policyerna behöver inte ändras: de släpper bara igenom 'approved', så
-- en obekräftad förfrågan är lika osynlig för bolagen som en ogranskad.

alter table inquiries drop constraint if exists inquiries_moderation_status_check;
alter table inquiries
  add constraint inquiries_moderation_status_check
  check (moderation_status in ('unconfirmed', 'pending', 'approved', 'rejected'));

-- Bekräftelselänken i mejlet. Bara hashen sparas, som för uppföljningslänken.
alter table inquiries add column if not exists bekraftelse_token_hash text;
create unique index if not exists inquiries_bekraftelse_token_hash
  on inquiries (bekraftelse_token_hash)
  where bekraftelse_token_hash is not null;

-- När avsändaren bekräftade sin adress. Null för förfrågningar från före
-- den här migrationen, som granskades manuellt i stället.
alter table inquiries add column if not exists bekraftad_at timestamptz;

-- Varför en förfrågan gick till manuell granskning, i klartext. Tom/null när
-- den godkändes automatiskt.
alter table inquiries add column if not exists granskningsorsaker text[];

-- Vem som fattade beslutet: 'auto' eller 'admin'. Null för gamla rader.
alter table inquiries add column if not exists moderated_by text
  check (moderated_by is null or moderated_by in ('auto', 'admin'));

-- När en redan godkänd förfrågan drogs tillbaka. moderated_at lämnas orört,
-- så att det fortfarande syns när den blev synlig för bolagen.
alter table inquiries add column if not exists tillbakadragen_at timestamptz;

comment on column inquiries.bekraftelse_token_hash is
  'SHA-256 av token i bekräftelseknappen i mejlet till avsändaren. Se lib/automatiskGranskning.js.';
comment on column inquiries.granskningsorsaker is
  'Varför förfrågan gick till manuell granskning i stället för att godkännas automatiskt.';

notify pgrst, 'reload schema';
