-- Bolagen får skriva sina egna nyckeltal — vid sidan av registrets, inte i
-- stället för dem.
--
-- Hittills har siffrorna varit låsta: omsättning, medarbetare och grundat kom
-- ur Bolagsverket och årsredovisningar, och godkännandemejlet lovade till och
-- med att de "inte går att ändra". Det håller inte när profilen ska vara
-- bolagets egen. Omsättningen i registret är ofta räkenskapsåret 2024, hämtad
-- en gång ur en årsredovisning, och den som tar över sin profil 2026 ska kunna
-- skriva dit årets siffra.
--
-- Men den reviderade siffran är värd för mycket för att skrivas över. Två skäl:
--
--   1. Köparen jämför bolag med varandra. En siffra bolaget skrivit själv och en
--      hämtad ur en årsredovisning är inte samma sorts uppgift. Står båda kvar
--      behåller jämförelsen sitt ankare — och bolagets egen siffra blir starkare,
--      inte svagare, av att stå bredvid den reviderade.
--   2. Skrev bolaget över kolumnen vore den borta för gott. Vi skulle inte ens
--      kunna fylla på med nästa årsredovisning utan att radera bolagets uppgift.
--
-- Därför: companies.revenue/employees/founded förblir REGISTRETS kolumner och
-- rörs aldrig av ett bolag. Bolagets egna tal ligger i company_key_figures, och
-- profilen visar dem överst med registrets som jämförelsetal under.
--
-- Formen är platt, med ett datum per uppgift:
--   { "revenue": "268 Mkr", "revenue_year": 2026, "revenue_updated": "2026-09-27",
--     "employees": "312", "employees_year": 2026, "employees_updated": "..." }
--
-- En nyckel som saknas betyder att bolaget inte rört den uppgiften, och då är
-- registrets tal det enda som visas.
--
-- TILLÄGG efter körningen: grundat togs bort ur de redigerbara fälten. Det är en
-- registreringsuppgift och inte ett tal som åldras mellan boksluten, så det
-- kommer bara ur registret. Kolumnen är oförändrad — se EGNA_NYCKELTAL i
-- lib/nyckeltal.js för vad som faktiskt skrivs.
--
-- Vad bolaget INTE får ändra, och varför: organisationsnumret är identiteten
-- hela registret matchar på — granskningskön, kohortlistan och kontrollen mot
-- Bolagsverket — och ett bolag som kan ändra det kan peka sitt konto mot en
-- annan juridisk person. Namnet styr slugen, alltså adressen till profilen.
-- Båda ändras av oss, efter att bolaget hört av sig.

alter table companies add column if not exists company_key_figures jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_company_key_figures_ar_objekt') then
    alter table companies add constraint companies_company_key_figures_ar_objekt
      check (jsonb_typeof(company_key_figures) = 'object');
  end if;
end $$;

notify pgrst, 'reload schema';
