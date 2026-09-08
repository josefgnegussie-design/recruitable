-- Förstapartsstatistik + faktureringsunderlag för Recruitables egen dashboard.
--
-- Två skilda saker i samma migration, av samma skäl som loggboken byggdes som
-- den gjordes: siffror om FÖRFRÅGNINGAR läses direkt ur de tabeller som redan
-- styr vad bolagen ser (inquiries, inquiry_recipients), aldrig ur en parallell
-- statistiktabell som kan hamna ur synk. Bara TRAFIK — sidvisningar och
-- sökningar — behöver en egen tabell, för den finns ingen annanstans hos oss.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.

-- ============================================================
-- TABELL: site_events
-- Cookielös förstapartsmätning. Ingen IP-adress och ingen user agent sparas.
-- visitor_hash är en envägshash av dagens salt + IP + user agent, som byts
-- varje dygn — den finns bara för att kunna skilja "50 sidvisningar av en
-- person" från "50 personer", och går inte att följa mellan dagar. Saknas
-- STATISTIK_SALT i miljön skrivs den som null: sidvisningar räknas ändå,
-- men unika besökare visas inte. Det är avsiktligt — hellre ingen siffra
-- än en pseudonym utan skydd.
-- ============================================================
create table if not exists site_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('sidvisning', 'sokning')),
  path text not null,
  visitor_hash text,
  -- För 'sokning': vilka filter besökaren använde (omrade/tjanst/ort).
  -- Aldrig fritext från besökaren, bara värden ur våra egna listor.
  metadata jsonb not null default '{}'
);

create index if not exists site_events_occurred_at_idx on site_events (occurred_at desc);
create index if not exists site_events_type_time_idx on site_events (event_type, occurred_at desc);

alter table site_events enable row level security;

-- Medvetet utan policyer: bara service role-nyckeln (som går förbi RLS)
-- skriver och läser. Samma resonemang som för inquiries — ingen anon- eller
-- authenticated-roll ska kunna läsa besöksmönster.

-- ============================================================
-- KOLUMN: inquiries.moderated_at
-- När Recruitable godkände/nekade förfrågan. Utan den går det inte att säga
-- vilken månad ett bolag faktiskt kunde agera på en förfrågan — bara när
-- avsändaren skickade den. Faktureringsunderlaget behöver det första.
-- ============================================================
alter table inquiries add column if not exists moderated_at timestamptz;

comment on column inquiries.moderated_at is
  'När förfrågan godkändes eller nekades av Recruitable. Sätts av /api/admin/moderera-forfragan. Null för rader som modererades innan kolumnen fanns.';

-- Bakåtfyllnad: redan modererade rader får sitt skapandedatum, så att
-- underlaget inte tappar historik. Ungefärligt, men aldrig fel månad med
-- mer än granskningens ledtid.
update inquiries
   set moderated_at = created_at
 where moderation_status <> 'pending'
   and moderated_at is null;

-- ============================================================
-- FUNKTIONER
-- All aggregering sker i databasen. Alternativet — att hämta hem raderna och
-- summera i Node — går sönder tyst vid 1 000 rader, eftersom det är taket
-- Supabase-klienten returnerar som standard.
--
-- Parametrarna heter p_* för att aldrig kunna krocka med ett kolumnnamn.
-- Intervallen är [p_fran, p_till), dvs. till-gränsen räknas inte med.
-- ============================================================

-- Sidvisningar och unika besökare per dag (svensk tid, så att "idag" betyder
-- idag och inte UTC-dygnet).
create or replace function statistik_trafik(p_fran timestamptz, p_till timestamptz)
returns table (dag date, sidvisningar bigint, besokare bigint)
language sql
stable
as $fn$
  select (e.occurred_at at time zone 'Europe/Stockholm')::date,
         count(*),
         count(distinct e.visitor_hash)
    from site_events e
   where e.event_type = 'sidvisning'
     and e.occurred_at >= p_fran
     and e.occurred_at < p_till
   group by 1
   order by 1;
$fn$;

-- Mest besökta sidor i perioden.
create or replace function statistik_toppsidor(p_fran timestamptz, p_till timestamptz, p_antal integer default 12)
returns table (path text, sidvisningar bigint, besokare bigint)
language sql
stable
as $fn$
  select e.path,
         count(*),
         count(distinct e.visitor_hash)
    from site_events e
   where e.event_type = 'sidvisning'
     and e.occurred_at >= p_fran
     and e.occurred_at < p_till
   group by e.path
   order by 2 desc, e.path
   limit p_antal;
$fn$;

-- Vad besökarna söker på. Varje sökning bidrar med ett värde per ifyllt
-- filter, så ett område och en ort i samma sökning räknas i var sin lista.
create or replace function statistik_sokfilter(p_fran timestamptz, p_till timestamptz, p_antal integer default 60)
returns table (falt text, varde text, antal bigint)
language sql
stable
as $fn$
  select f.key,
         f.value,
         count(*)
    from site_events e
    cross join lateral jsonb_each_text(e.metadata) as f(key, value)
   where e.event_type = 'sokning'
     and e.occurred_at >= p_fran
     and e.occurred_at < p_till
     and f.value <> ''
   group by f.key, f.value
   order by 3 desc, 2
   limit p_antal;
$fn$;

-- Summering av förfrågningsflödet i perioden.
create or replace function statistik_forfragningar(p_fran timestamptz, p_till timestamptz)
returns table (
  inkomna bigint,
  godkanda bigint,
  nekade_av_oss bigint,
  vantar_granskning bigint,
  utskick bigint,
  accepterade bigint,
  nekade bigint,
  obesvarade bigint,
  median_svarstid_timmar numeric
)
language sql
stable
as $fn$
  with i as (
    select * from inquiries
     where created_at >= p_fran and created_at < p_till
  ),
  r as (
    -- Bara utskick som bolagen faktiskt kunnat se, dvs. godkända förfrågningar.
    -- En förfrågan vi själva nekat har aldrig nått något bolag och hör varken
    -- hemma i svarsfrekvensen eller på en faktura.
    select rec.*
      from inquiry_recipients rec
      join inquiries inq on inq.id = rec.inquiry_id
     where inq.moderation_status = 'approved'
       and coalesce(inq.moderated_at, inq.created_at) >= p_fran
       and coalesce(inq.moderated_at, inq.created_at) < p_till
  )
  select (select count(*) from i),
         (select count(*) from i where i.moderation_status = 'approved'),
         (select count(*) from i where i.moderation_status = 'rejected'),
         (select count(*) from i where i.moderation_status = 'pending'),
         (select count(*) from r),
         (select count(*) from r where r.status = 'accepted'),
         (select count(*) from r where r.status = 'declined'),
         (select count(*) from r where r.status = 'pending'),
         (select round(
                   percentile_cont(0.5) within group (
                     order by extract(epoch from (r.responded_at - r.created_at)) / 3600.0
                   )::numeric, 1)
            from r where r.responded_at is not null);
$fn$;

-- Faktureringsunderlaget: ett bolag per rad, räknat på när förfrågan blev
-- synlig för bolaget (moderated_at), inte när avsändaren skrev den.
create or replace function statistik_underlag_per_bolag(p_fran timestamptz, p_till timestamptz)
returns table (
  company_id integer,
  bolag text,
  ort text,
  premium boolean,
  utskick bigint,
  accepterade bigint,
  nekade bigint,
  obesvarade bigint,
  median_svarstid_timmar numeric
)
language sql
stable
as $fn$
  select c.id,
         c.name,
         c.city,
         c.is_premium,
         count(*),
         count(*) filter (where r.status = 'accepted'),
         count(*) filter (where r.status = 'declined'),
         count(*) filter (where r.status = 'pending'),
         round(
           percentile_cont(0.5) within group (
             order by extract(epoch from (r.responded_at - r.created_at)) / 3600.0
           )::numeric, 1)
    from inquiry_recipients r
    join inquiries i on i.id = r.inquiry_id
    join companies c on c.id = r.company_id
   where i.moderation_status = 'approved'
     and coalesce(i.moderated_at, i.created_at) >= p_fran
     and coalesce(i.moderated_at, i.created_at) < p_till
   group by c.id, c.name, c.city, c.is_premium
   order by count(*) filter (where r.status = 'accepted') desc, count(*) desc, c.name;
$fn$;

-- Utfall per månad, för trendkurvan i dashboarden.
create or replace function statistik_utfall_per_manad(p_manader integer default 12)
returns table (manad date, utskick bigint, accepterade bigint, nekade bigint, obesvarade bigint)
language sql
stable
as $fn$
  select date_trunc('month', coalesce(i.moderated_at, i.created_at) at time zone 'Europe/Stockholm')::date,
         count(*),
         count(*) filter (where r.status = 'accepted'),
         count(*) filter (where r.status = 'declined'),
         count(*) filter (where r.status = 'pending')
    from inquiry_recipients r
    join inquiries i on i.id = r.inquiry_id
   where i.moderation_status = 'approved'
     and coalesce(i.moderated_at, i.created_at) >= date_trunc('month', now()) - make_interval(months => p_manader - 1)
   group by 1
   order by 1;
$fn$;

-- ============================================================
-- BEHÖRIGHETER
-- Funktionerna aggregerar data som ingen utom Recruitable ska se — inte ens
-- ett inloggat bolag, som annars bara ser sina egna rader. Därför bara
-- service_role, precis som resten av det interna.
-- ============================================================
revoke execute on function statistik_trafik(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function statistik_toppsidor(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke execute on function statistik_sokfilter(timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke execute on function statistik_forfragningar(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function statistik_underlag_per_bolag(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function statistik_utfall_per_manad(integer) from public, anon, authenticated;

grant execute on function statistik_trafik(timestamptz, timestamptz) to service_role;
grant execute on function statistik_toppsidor(timestamptz, timestamptz, integer) to service_role;
grant execute on function statistik_sokfilter(timestamptz, timestamptz, integer) to service_role;
grant execute on function statistik_forfragningar(timestamptz, timestamptz) to service_role;
grant execute on function statistik_underlag_per_bolag(timestamptz, timestamptz) to service_role;
grant execute on function statistik_utfall_per_manad(integer) to service_role;
