-- Samma bakomliggande orsak som grant_service_role.sql: att stänga av
-- "Automatically expose new tables" blockerade grundrättigheterna för
-- ALLA Data API-roller, inte bara service_role — även "authenticated"
-- (inloggade användare) och "anon" (utloggade besökare) saknar grund-
-- rättigheter på tabellerna. Row Level Security-policyerna vi redan
-- skrivit avgör fortfarande VAD varje roll faktiskt får se/ändra rad för
-- rad — det här ger bara rollerna rätt att överhuvudtaget försöka.
--
-- Kör i Supabase SQL Editor.

grant usage on schema public to authenticated, anon;

grant select on public.companies to authenticated, anon;
grant update on public.companies to authenticated;
grant select on public.company_admins to authenticated;

alter default privileges in schema public grant select on tables to authenticated, anon;
