-- Bolag som upphör: sammanslagning, och avregistrering.
--
-- Bakgrund: registret bygger på offentliga källor och ger varje juridisk person
-- ett eget kort. Det är rätt i normalfallet — Jovi Konsult AB (Göteborg) och
-- Jovi Konsult Syd AB (Malmö) är två bolag med egna organisationsnummer, egna
-- kontor och egna årsredovisningar. Men tre saker gör att ett kort ändå måste
-- kunna sluta visas: en fusion hos Bolagsverket, en avregistrering, eller att en
-- koncern bestämt sig för att uppträda under ett namn.
--
-- Två fall, inte ett. Ett bolag som gått samman med ett annat har en efterträdare
-- att peka på; ett avregistrerat bolag har oftast ingen. Därför är "slutar visas"
-- (retired_at) skilt från "pekar vidare hit" (merged_into) — annars hade varje
-- avregistrering krävt ett påhittat överlevande bolag.
--
-- Raden RADERAS aldrig. Fyra skäl:
--   1. inquiry_recipients och offices ligger på "on delete cascade" — en delete
--      tar tyst med sig varje förfrågan bolaget fått och varje kontorsrad,
--      inklusive betalda som Stripe fortsätter debitera.
--   2. Slugen måste fortsätta svara. Ett raderat bolag ger 404 på varje länk och
--      bokmärke som pekar dit; ett sammanslaget ger 308 till bolaget som lever,
--      och ett avregistrerat visar sin profil med beskedet att bolaget upphört —
--      vilket är just vad den som söker efter det behöver veta.
--   3. Registret byggs om ur import (supabase/synka_register.sql har
--      "on conflict (id) do nothing"), så en handraderad rad kommer tillbaka tom.
--   4. Beslutet ska gå att se i efterhand, och att gå tillbaka på.
--
-- Kör i Supabase SQL Editor. Starta om dev-servern efteråt — mängden `saknade`
-- i lib/companiesRepo.js lever på modulnivå och minns att kolumnen saknades.

-- ============================================================
-- 1. Kolumnerna på companies
-- ============================================================
-- Beslutet: bolaget visas inte längre, och varför.
alter table companies add column if not exists retired_at timestamptz;
alter table companies add column if not exists retired_reason text;
-- Frivillig efterträdare. Satt = profilen skickar vidare dit.
alter table companies add column if not exists merged_into integer references companies(id);

-- Uppgifterna från Bolagsverket, skrivna av /api/cron/bolagsverket-koll.
-- Rena fakta: jobbet döljer aldrig något självt, det lägger ett ärende på bordet.
alter table companies add column if not exists deregistered_at date;
alter table companies add column if not exists bolagsverket_checked_at timestamptz;
-- Bolagsverkets "verksamOrganisation". Ett bolag kan vara registrerat men inte
-- verksamt — vid ett stickprov på 40 bolag ur registret gällde det 2 av dem.
-- Uppgiften sparas men köar ingenting: att inte vara verksam är ett svagare och
-- mer tvetydigt besked än en avregistrering, och duger inte som skäl att ta bort
-- ett bolag. Den står som upplysning bredvid de ärenden som ändå uppstår.
alter table companies add column if not exists bolagsverket_active boolean;
-- Granskaren har sett avregistreringen och valt att låta bolaget stå kvar ändå.
-- Utan den här skulle kön tjata om samma bolag varje dag, och en kö som alltid
-- har något i sig slutar man titta i.
alter table companies add column if not exists deregistration_handled_at timestamptz;

-- Bara raderna som faktiskt upphört indexeras — de är en handfull, och frågan
-- "vad pekar hit" ställs vid varje godkännande.
create index if not exists companies_merged_into_idx
  on companies (merged_into)
  where merged_into is not null;

create index if not exists companies_retired_at_idx
  on companies (retired_at)
  where retired_at is not null;

-- Kön i /admin: avregistrerade som ingen tagit ställning till än.
create index if not exists companies_deregistered_idx
  on companies (deregistered_at)
  where deregistered_at is not null and retired_at is null and deregistration_handled_at is null;

-- Kontrollens turordning: äldst kontrollerade först, aldrig kontrollerade allra
-- först. Utan index blir det en sortering över hela registret vid varje körning.
create index if not exists companies_bolagsverket_koll_idx
  on companies (bolagsverket_checked_at nulls first)
  where org_number is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_retired_reason_check') then
    alter table companies add constraint companies_retired_reason_check
      check (retired_reason is null or retired_reason in ('fusion', 'koncernbeslut', 'avregistrerad'));
  end if;

  -- Tidpunkt och skäl sätts tillsammans, och en efterträdare förutsätter att
  -- bolaget faktiskt upphört. Utan det kan en rad bli osynlig i sökningen utan
  -- att någon kan se när eller varför.
  if not exists (select 1 from pg_constraint where conname = 'companies_retired_falt_ihop_check') then
    alter table companies add constraint companies_retired_falt_ihop_check
      check (
        (retired_at is null and retired_reason is null and merged_into is null)
        or (retired_at is not null and retired_reason is not null)
      );
  end if;

  -- Ett bolag kan inte gå upp i sig självt. Skrivfel i en route ska stoppas av
  -- databasen och inte upptäckas av en besökare som hamnar i en 308-slinga.
  if not exists (select 1 from pg_constraint where conname = 'companies_merge_ej_sig_sjalv_check') then
    alter table companies add constraint companies_merge_ej_sig_sjalv_check
      check (merged_into is distinct from id);
  end if;
end $$;

-- ============================================================
-- 2. Kedjor
-- ============================================================
-- A går upp i B, och senare går B upp i C. Då pekar A på ett bolag som inte
-- längre visas, och vidarebefordran leder till en profil som själv bara
-- vidarebefordrar. Två utlösare håller kedjorna platta:
--
--   kontroll: det går inte att peka på ett bolag som självt upphört.
--   kedja:    när ett bolag upphör pekas allt som pekade på det om.
--
-- Koden gör samma sak innan den skriver (lib/sammanslagning.js), men reglerna
-- ska gälla även om en route skulle ha fel — som RLS gäller även vid en bugg.
create or replace function sammanslagning_kontroll() returns trigger as $$
declare
  malets_mal integer;
  malet_upphort timestamptz;
begin
  if new.merged_into is null then
    return new;
  end if;

  select merged_into, retired_at into malets_mal, malet_upphort
    from companies where id = new.merged_into;

  if malet_upphort is not null then
    raise exception
      'Bolag % har självt upphört%. Peka på ett bolag som finns kvar i registret.',
      new.merged_into,
      case when malets_mal is null then '' else format(' (sammanslaget med %s)', malets_mal) end;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists companies_sammanslagning_kontroll on companies;
create trigger companies_sammanslagning_kontroll
  before insert or update of merged_into on companies
  for each row execute function sammanslagning_kontroll();

create or replace function sammanslagning_flytta_kedja() returns trigger as $$
begin
  -- Bara när det finns en ny adressat. Ett avregistrerat bolag utan efterträdare
  -- har ingenstans att skicka de bolag som pekade på det — de får stå kvar och
  -- visa sin egen profil med beskedet att bolaget de pekade på upphört.
  if new.merged_into is null then
    return null;
  end if;

  update companies
    set merged_into = new.merged_into
    where merged_into = new.id
      and id <> new.merged_into;

  return null;
end;
$$ language plpgsql;

-- Bara vid övergången från "visas" till "upphört". Den omskrivning utlösaren
-- själv gör träffar rader där old.retired_at redan var satt, så den kan inte
-- utlösa sig själv i en slinga.
drop trigger if exists companies_sammanslagning_kedja on companies;
create trigger companies_sammanslagning_kedja
  after update of retired_at on companies
  for each row
  when (new.retired_at is not null and old.retired_at is null)
  execute function sammanslagning_flytta_kedja();

-- ============================================================
-- 3. TABELL: merge_requests — begäran, inte verkställighet
-- ============================================================
-- Ingen sammanslagning sker automatiskt. Skälet är att behörigheten inte går
-- att avgöra maskinellt: Bolagsverkets värdefulla datamängder ger inte
-- ägarstruktur, så vi kan inte verifiera att Jovi Konsult AB äger Jovi Konsult
-- Syd AB. Det som går att verifiera är att den som begär det är verifierad
-- ägare av ett av de två bolagen (mejldomänen har redan matchats mot
-- webbplatsen vid registreringen). Resten är en människas bedömning.
--
-- Utan den spärren vore det här en knapp för att radera en konkurrent ur
-- registret.
create table if not exists merge_requests (
  id uuid primary key default gen_random_uuid(),

  -- Bolaget som ska upphöra att visas.
  company_id integer not null references companies(id) on delete cascade,
  -- Bolaget som lever vidare och tar över orterna.
  survivor_id integer not null references companies(id) on delete cascade,

  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('fusion', 'koncernbeslut', 'avregistrerad')),
  -- Datum för fusionen/avregistreringen när bolaget uppger ett. Fritt fält:
  -- vid ett koncernbeslut finns inget datum att hänvisa till.
  effective_date date,
  message text,

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  decision_note text,

  created_at timestamptz not null default now(),

  constraint merge_requests_tva_olika_bolag check (company_id <> survivor_id)
);

-- Ett öppet ärende per bolag. Annars kan samma bolag ligga i kön tre gånger med
-- tre olika överlevande, och vilket som verkställs beror på vilken rad
-- granskaren råkar klicka på först.
create unique index if not exists merge_requests_ett_oppet_per_bolag
  on merge_requests (company_id)
  where status = 'pending';

create index if not exists merge_requests_status_idx on merge_requests (status, created_at);

alter table merge_requests enable row level security;

-- Ingen insert/update-policy: ärenden skapas och avgörs bara via backend med
-- service role, efter ägarkontrollen i lib/bolagsadmin.js. Samma resonemang som
-- för offices — en update-policy för inloggade hade låtit ett bolag sätta
-- status = 'approved' på sitt eget ärende, och RLS kan inte begränsa kolumner.
drop policy if exists "Verifierad admin ser sitt bolags sammanslagningar" on merge_requests;
create policy "Verifierad admin ser sitt bolags sammanslagningar"
  on merge_requests for select
  using (
    exists (
      select 1 from company_admins
      where company_admins.user_id = auth.uid()
        and company_admins.verified = true
        and company_admins.company_id in (merge_requests.company_id, merge_requests.survivor_id)
    )
  );

grant select on public.merge_requests to authenticated;

notify pgrst, 'reload schema';
