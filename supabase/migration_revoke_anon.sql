-- Den publika rollen (anon) hade fler rättigheter än den behöver på tabellerna
-- med personuppgifter: SELECT på förfrågningarna, och TRUNCATE/TRIGGER/REFERENCES
-- på alla tre. Ingenting av det används — all åtkomst går antingen via
-- serverrutter (service_role) eller via inloggade användare (authenticated).
--
-- Praktiskt sett var det ingen öppen dörr: row level security är påslaget och
-- ingen policy släpper in anon, så SELECT gav noll rader ändå, och Supabases
-- REST-API exponerar inte TRUNCATE. Men rättigheterna hörde inte dit, och om
-- någon i framtiden lägger till en bredare policy eller stänger av RLS blir de
-- plötsligt verksamma. Bättre att de inte finns.
--
-- Källan till SELECT-rättigheten var raden i grant_authenticated.sql som ger
-- anon läsrätt på alla framtida tabeller. Den tas bort här: det som ska vara
-- publikt läsbart pekas i stället ut uttryckligen.

revoke all on public.company_admins from anon;
revoke all on public.inquiries from anon;
revoke all on public.inquiry_recipients from anon;

alter default privileges in schema public revoke select on tables from anon;

grant select on public.companies to anon;
grant select on public.offices to anon;

notify pgrst, 'reload schema';
