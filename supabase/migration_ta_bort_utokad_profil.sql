-- Tar bort den utökade premiumprofilen helt: omslagsbild, utökad vision,
-- mission, historia, erfarenhet och medarbetare.
--
-- Bakgrund: fälten gick bara att redigera via ProfileEditor, som togs ur
-- Mina sidor när profilformuläret slogs ihop till ett. De renderades alltså
-- fortfarande på premiumbolagens profiler utan att någon kunde ändra dem.
-- Beslutet blev att ta bort dem i stället för att koppla in redigeringen igen —
-- profilen består av de uppgifter en kund faktiskt jämför leverantörer på.
--
-- Innehållet som försvinner: ett (1) bolag hade data i fälten (id 20, Intenso
-- Teknikrekrytering), och det var testdata — "Test", "Testmission",
-- "Testhistoria", "Testerfarenhet" och en påhittad medarbetare. Noll bolag har
-- is_premium = true, så ingenting av det visades publikt. Kontrollerat
-- 2026-09-12 före körning.
--
-- OBS: storage-bucketen `company-media` och dess policyer i
-- migration_premium_profile.sql ska INTE röras — logotyp och bildspel laddas upp
-- dit. Bara kolumnen cover_image försvinner därifrån.
--
-- Kvar i bucketen ligger en föräldralös omslagsbild under 20/cover/. Den tas
-- inte bort här: att radera lagrade filer är irreversibelt och hör inte hemma i
-- samma steg som ett schemabyte.

alter table companies drop column if exists cover_image;
alter table companies drop column if exists extended_vision;
alter table companies drop column if exists mission;
alter table companies drop column if exists history;
alter table companies drop column if exists expertise;
alter table companies drop column if exists team_members;

notify pgrst, 'reload schema';
