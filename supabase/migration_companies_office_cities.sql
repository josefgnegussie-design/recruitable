-- Bolagsprofilen visar vilka orter ett bolag har kontor på ("Flera orter" i
-- rubriken, och den fullständiga listan bland fakta i sidospalten). Uppgiften
-- fanns bara i den statiska lib/companies.js, inte i tabellen — och när registret
-- flyttar till databasen måste den följa med, annars tappar varje bolag med fler
-- än ett kontor den informationen.

alter table companies add column if not exists office_cities text[] not null default '{}';

notify pgrst, 'reload schema';
