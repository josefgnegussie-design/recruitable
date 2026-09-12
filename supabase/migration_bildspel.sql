-- Bildspel på bolagsprofilen: upp till fem bilder från verksamheten, i den
-- ordning bolaget lagt dem. Ordningen är innehåll och inte en sorteringsdetalj,
-- därför text[] och inte en egen tabell — listan är kort, alltid hämtad i sin
-- helhet, och har ingen egen livslängd vid sidan av bolaget.
--
-- Filerna ligger i storage-bucketen `company-media` under
-- <company_id>/bildspel/<uuid>.<ext>, samma väg som logotyp och omslagsbild.
-- Kolumnen håller de publika URL:erna.
--
-- Taket på fem sätts i formuläret (components/admin/BildspelField.js) och i
-- /api/profil/grunduppgifter. Medvetet inget check-villkor här: ändras antalet
-- är det ett produktbeslut i koden, och ett constraint som säger emot koden ger
-- ett obegripligt 500-fel i stället för ett begripligt valideringsfel.

alter table companies add column if not exists slideshow text[] not null default '{}';
