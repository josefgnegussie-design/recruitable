-- Bolagen får äga sina egna nyckeltal.
--
-- Hittills har siffrorna varit låsta: omsättning, medarbetare och grundat kom
-- ur Bolagsverket och årsredovisningar, och bolaget fick bara skriva den mjuka
-- delen av profilen. Godkännandemejlet lovade till och med att uppgifterna
-- "ligger kvar och går inte att ändra".
--
-- Det håller inte när profilen ska vara bolagets egen. Omsättningen i registret
-- är ofta räkenskapsåret 2024, hämtat en gång ur en årsredovisning, och den som
-- tar över sin profil 2026 ska kunna skriva dit årets siffra — och tala om
-- vilket år den gäller. Samma sak för antalet medarbetare. Efter övertagandet
-- har källorna gjort sitt.
--
-- MEN: hela registrets värde för en köpare är att siffrorna går att jämföra.
-- En omsättning bolaget skrivit själv och en hämtad ur en årsredovisning är
-- inte samma sorts uppgift, och att visa dem som om de vore det vore att ljuga
-- tyst. Därför spåras VILKA fält bolaget tagit över och NÄR, så att profilen
-- kan säga "uppgift från bolaget, uppdaterad september 2026" där det gäller och
-- "enligt Bolagsverket och årsredovisning" där det fortfarande gäller.
--
-- Formen är { "revenue": "2026-09-27", "employees": "2026-09-27" } — en nyckel
-- per fält bolaget rört, med datumet det senast gjordes. Ett fält som saknas i
-- objektet kommer alltjämt från registret. En jsonb och inte en kolumn per fält:
-- fälten är få men kommer att bli fler, och varje nytt nyckeltal ska inte kräva
-- en ny migration bara för att kunna märkas med sin källa.
--
-- Vad bolaget INTE får ändra, och varför: organisationsnumret är identiteten
-- hela registret matchar på — granskningskön, kohortlistan och kontrollen mot
-- Bolagsverket — och ett bolag som kan ändra det kan peka sitt konto mot en
-- annan juridisk person. Namnet styr slugen, alltså adressen till profilen.
-- Båda ändras av oss, efter att bolaget hört av sig.

alter table companies add column if not exists key_figures_updated jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_key_figures_updated_ar_objekt') then
    alter table companies add constraint companies_key_figures_updated_ar_objekt
      check (jsonb_typeof(key_figures_updated) = 'object');
  end if;
end $$;

notify pgrst, 'reload schema';
