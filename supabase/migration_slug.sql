-- Adressvänligt namn på bolagsprofilen: /bolag/jovi-konsult i stället för
-- /bolag/1.
--
-- Kolumnen läggs till utan not null, eftersom den fylls i av
-- scripts/bygg-slugar.mjs efter att migrationen körts. Unikhetskravet finns
-- från början — två bolag med samma adress vore tystare och värre än ett fel
-- vid backfyllningen.
--
-- Körd på hela registret gav generatorn 3 770 unika slugar av 3 770 bolag,
-- alltså noll krockar. Kravet är ändå kvar: nya bolag tillkommer, och
-- unikSlug() i lib/slug.js hänger på en siffra när det behövs.
--
-- Id:t blir kvar som primärnyckel och fortsätter fungera i adressen — routen
-- svarar med en permanent omdirigering till slugen, så gamla länkar och
-- bokmärken inte dör.

alter table companies add column if not exists slug text;

create unique index if not exists companies_slug_key on companies (slug);

notify pgrst, 'reload schema';
