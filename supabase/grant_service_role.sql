-- Ger service_role (används av vår betrodda backend-kod, t.ex.
-- lib/supabase/admin.js) fulla rättigheter på alla tabeller i public-schemat.
--
-- Bakgrund: vi valde medvetet att stänga av "Automatically expose new
-- tables" när projektet skapades (för att styra API-exponering manuellt),
-- vilket visade sig även blockera service_role-rollens egna grundrättigheter
-- — inte bara den publika API-åtkomsten. Det här skriptet ger tillbaka just
-- service_role sina rättigheter, utan att ändra något i hur RLS eller den
-- publika API-exponeringen fungerar.
--
-- Kör i Supabase SQL Editor.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Så att framtida tabeller vi lägger till automatiskt får samma rättigheter,
-- utan att vi behöver komma ihåg att köra det här på nytt varje gång.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
