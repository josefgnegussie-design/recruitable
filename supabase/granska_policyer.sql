-- Granskning av row level security: är skyddet påslaget, finns policyerna, och
-- är de den täta versionen? Läser bara metadata och ändrar ingenting.
--
-- Kolumngranskningen (granska_schema.sql) räcker inte här. En policy kan finnas
-- kvar under rätt namn men i en äldre, läckande version — då rapporterar en
-- namnkontroll "ok" trots att hålet står öppet. Del 3 nedan tittar därför på
-- själva regeluttrycket.
--
-- Kör en del i taget och klistra in resultatet.


-- ===========================================================================
-- DEL 1 — Är row level security påslaget på tabellerna?
-- Allt utom 'på' betyder att vem som helst med anon-nyckeln kan läsa tabellen.
-- ===========================================================================

select
  c.relname as tabell,
  case when c.relrowsecurity then 'på' else 'AV — ALLVARLIGT' end as rls,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as antal_policyer
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('companies', 'company_admins', 'inquiries', 'inquiry_recipients', 'offices')
order by c.relrowsecurity, c.relname;


-- ===========================================================================
-- DEL 2 — Finns alla policyer som migrationerna skapar?
-- ===========================================================================

with forvantade(schema_namn, tabell, policy) as (
  values
    ('public', 'companies', 'Publik läsåtkomst till bolag'),
    ('public', 'companies', 'Verifierad admin kan uppdatera sitt eget bolag'),
    ('public', 'company_admins', 'Användare ser sina egna adminrader'),
    ('public', 'inquiries', 'Verifierad admin ser förfrågningsinnehåll för sitt bolag'),
    ('public', 'inquiry_recipients', 'Verifierad admin ser mottagarrader för sitt bolag'),
    ('public', 'inquiry_recipients', 'Verifierad admin kan sätta status för sitt bolag'),
    ('public', 'offices', 'Publik läsåtkomst till kontor'),
    ('storage', 'objects', 'Publik läsning av bolagsbilder'),
    ('storage', 'objects', 'Verifierad admin kan ladda upp till sitt eget bolags mapp'),
    ('storage', 'objects', 'Verifierad admin kan uppdatera sitt eget bolags bilder'),
    ('storage', 'objects', 'Verifierad admin kan radera sitt eget bolags bilder')
)
select
  f.schema_namn,
  f.tabell,
  f.policy,
  case when p.policyname is null then 'SAKNAS' else 'ok' end as status
from forvantade f
left join pg_policies p
  on p.schemaname = f.schema_namn
 and p.tablename = f.tabell
 and p.policyname = f.policy
order by status desc, f.schema_namn, f.tabell, f.policy;


-- ===========================================================================
-- DEL 3 — Är förfrågningspolicyerna den täta versionen?
--
-- migration_inquiry_moderation.sql ersatte två policyer för att stänga ett hål:
-- tidigare kunde en bolagsadmin läsa förfrågningar direkt via Supabase-klienten
-- i webbläsaren utan att förfrågan var godkänd. Den täta versionen kräver
-- moderation_status = 'approved' i själva databasregeln.
--
-- Står det LÄCKER här ska den migrationen köras innan sajten öppnas.
-- ===========================================================================

select
  tablename as tabell,
  policyname as policy,
  case
    when qual::text like '%moderation_status%' then 'tät'
    else 'LÄCKER — saknar moderation_status'
  end as bedomning
from pg_policies
where schemaname = 'public'
  and policyname in (
    'Verifierad admin ser mottagarrader för sitt bolag',
    'Verifierad admin ser förfrågningsinnehåll för sitt bolag'
  )
order by bedomning, tablename;


-- ===========================================================================
-- DEL 4 — Behörigheter för anon och authenticated.
--
-- Här ska INGET oväntat dyka upp. anon ska bara kunna läsa companies och
-- offices. Ser du anon med select på inquiries, inquiry_recipients eller
-- company_admins är det illa — då hänger allt på att RLS är rätt satt.
-- ===========================================================================

select
  grantee as roll,
  table_name as tabell,
  string_agg(distinct privilege_type, ', ' order by privilege_type) as rattigheter
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by grantee, table_name
order by grantee, table_name;
