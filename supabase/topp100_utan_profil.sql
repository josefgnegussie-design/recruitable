-- Läser bara — ändrar ingenting.
--
-- Listar de 100 bolagen med högst omsättning i registret och visar vilka av dem
-- som saknar skriven profil (vision). Underlaget scripts/data/profilunderlag.xlsx
-- byggs ur de lokala filerna; den här frågan svarar för vad som faktiskt står i
-- databasen, vilket är det som syns på sajten.
--
-- revenue lagras som text ("1 967,1 Mkr"), så talet plockas fram här: bort med
-- " Mkr" och "(koncern)", bort med mellanslag (även hårt mellanslag) och komma
-- till punkt. Rader utan tolkningsbar omsättning faller utanför rangordningen.

with tolkat as (
  select
    id,
    name,
    org_number,
    city,
    revenue,
    employees,
    link,
    vision,
    nullif(
      translate(
        regexp_replace(coalesce(revenue, ''), '(Mkr|\(koncern\))', '', 'gi'),
        ',' || ' ' || chr(160),   -- komma, vanligt mellanslag, hårt mellanslag
        '.'                        -- kommat blir punkt, mellanslagen faller bort
      ),
    '')::numeric as omsattning_mkr
  from companies
),
topp as (
  select *, row_number() over (order by omsattning_mkr desc) as rang
  from tolkat
  where omsattning_mkr is not null
  order by omsattning_mkr desc
  limit 100
)
select
  rang,
  id,
  name,
  org_number,
  city,
  revenue,
  employees,
  link,
  case when coalesce(btrim(vision), '') = '' then 'saknas' else 'skriven' end as profil
from topp
order by rang;

-- Bara antalet, om det är det som ska stämmas av:
--
-- select count(*) filter (where coalesce(btrim(vision), '') = '') as saknar_profil,
--        count(*) filter (where coalesce(btrim(vision), '') <> '') as har_profil
-- from topp;
