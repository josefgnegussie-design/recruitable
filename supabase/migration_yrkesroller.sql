-- Yrkesroller på bolagsprofilen.
--
-- Kolumnen fanns redan i supabase/migration_recruiting_roles.sql, men den
-- migrationen har bara körts till hälften: company_admins.claimed_focus_areas
-- finns i produktion, medan companies.recruiting_roles och
-- companies.recruiting_focus_areas aldrig lades till (kontrollerat 2026-09-09
-- mot PostgREST — de två senare ger 400 "column does not exist").
--
-- Premissen har också ändrats. Den gamla migrationen beskrev fältet som
-- "osynliga taggar — visas inte publikt, används bara för framtida matchning".
-- Rollerna ska nu tvärtom synas i registret: den som söker en CNC-operatör ska
-- se vilka bolag som faktiskt rekryterar just den rollen, inte bara att de
-- arbetar inom "Industriell tillverkning".
--
-- recruiting_focus_areas lämnas medvetet därhän. Yrkesområdena bor i
-- companies.focus, som redan används av både sökningen och profilsidan; en
-- andra kolumn för samma sak vore två sanningar om samma uppgift.

alter table companies add column if not exists recruiting_roles text[] not null default '{}';

-- Sökningen filtrerar på rollen med `contains`, vilket utan index betyder en
-- full genomsökning per sökning i ett register som ska rymma tusentals bolag.
create index if not exists companies_recruiting_roles_idx
  on companies using gin (recruiting_roles);
