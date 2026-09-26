-- ISO-certifieringar på bolagsprofilen: ISO 9001 (kvalitetsledning) och
-- ISO 14001 (miljöledning). Bolaget kryssar själv i vilka de har — båda, en
-- eller ingen — och profilsidan visar uppgiften bara när listan inte är tom.
--
-- text[] och inte två booleaner: en tredje certifiering ska vara en rad i
-- lib/iso.js, inte en ny migration.
--
-- Giltiga värden kontrolleras i /api/profil/grunduppgifter mot lib/iso.js.
-- Medvetet inget check-villkor här, av samma skäl som i migration_bildspel.sql:
-- ett constraint som säger emot koden ger ett obegripligt 500-fel i stället
-- för ett begripligt valideringsfel.
--
-- Kör i Supabase SQL Editor.

alter table companies add column if not exists iso_certifications text[] not null default '{}';
