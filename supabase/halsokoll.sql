-- HÄLSOKOLL — kör hela den här filen i Supabase → SQL Editor.
--
-- Den läser bara metadata och ändrar ingenting. Svaret är en lista i klartext:
-- antingen "ALLT OK" på en enda rad, eller en rad per sak som behöver åtgärdas.
-- Inget att tolka — skicka bilden på resultatet vidare.

with problem as (

  -- Row level security avstängd = tabellen är läsbar för vem som helst med
  -- den publika nyckeln, oavsett vad applikationskoden gör.
  select
    1 as prio,
    'ÅTGÄRD: säkerheten (RLS) är avstängd på tabellen ' || c.relname as besked
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('companies', 'company_admins', 'inquiries', 'inquiry_recipients', 'offices')
    and not c.relrowsecurity

  union all

  -- Den gamla versionen av dessa två regler släppte igenom förfrågningar som
  -- inte var godkända. Den nya kräver moderation_status = 'approved'.
  select
    1,
    'ÅTGÄRD: regeln "' || policyname || '" på ' || tablename || ' är den gamla, läckande versionen'
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'Verifierad admin ser mottagarrader för sitt bolag',
      'Verifierad admin ser förfrågningsinnehåll för sitt bolag'
    )
    and coalesce(qual::text, '') not like '%moderation_status%'

  union all

  -- Den publika rollen ska bara kunna läsa bolag och kontor.
  select
    1,
    'ÅTGÄRD: publika rollen (anon) har ' || privilege_type || ' på ' || table_name
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and table_name in ('inquiries', 'inquiry_recipients', 'company_admins')

  union all

  -- Saknade regler.
  select
    2,
    'ÅTGÄRD: regeln "' || f.policy || '" saknas på ' || f.tabell
  from (values
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
  ) as f(schema_namn, tabell, policy)
  left join pg_policies p
    on p.schemaname = f.schema_namn
   and p.tablename = f.tabell
   and p.policyname = f.policy
  where p.policyname is null

)
select besked as resultat
from (
  select prio, besked from problem
  union all
  select 0, 'ALLT OK — inget behöver åtgärdas' where not exists (select 1 from problem)
) as rader
order by prio, besked;
