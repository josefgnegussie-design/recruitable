-- Granskning: vad migrationerna i supabase/ förväntar sig, jämfört med
-- vad databasen faktiskt innehåller. Läser bara metadata och ändrar ingenting.
--
-- Genererad av scripts/bygg-schemagranskning.mjs — kör om det scriptet när nya
-- migrationer tillkommit.
--
-- Medvetet utelämnade ur kontrollen:
--   company_admins.claimed_roles — ersatt av claimed_services (migration_signup_services.sql)
--   inquiry_recipients.released_at — tas bort av en senare migration


with forvantade_tabeller(tabell) as (
  values
    ('companies'),
    ('company_admins'),
    ('inquiries'),
    ('inquiry_recipients'),
    ('offices')
),
forvantade_kolumner(tabell, kolumn) as (
  values
    ('companies', 'cover_image'),
    ('companies', 'expertise'),
    ('companies', 'history'),
    ('companies', 'mission'),
    ('companies', 'org_number'),
    ('companies', 'premium_until'),
    ('companies', 'recruiting_focus_areas'),
    ('companies', 'recruiting_roles'),
    ('company_admins', 'claimed_address'),
    ('company_admins', 'claimed_company_name'),
    ('company_admins', 'claimed_focus_areas'),
    ('company_admins', 'claimed_org_number'),
    ('company_admins', 'claimed_services'),
    ('company_admins', 'claimed_website'),
    ('company_admins', 'office_id'),
    ('inquiries', 'moderation_status'),
    ('inquiries', 'requester_phone'),
    ('inquiry_recipients', 'responded_at'),
    ('inquiry_recipients', 'status')
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
