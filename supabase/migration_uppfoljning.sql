-- Uppföljningslänk för beställaren.
--
-- Bakgrund: efter "Tack!" såg beställaren aldrig vilka bolag som var
-- intresserade, hade tackat nej eller inte svarat. Beställarna har inga konton,
-- så i stället får varje förfrågan en hemlig länk (/forfragan/<token>) i
-- bekräftelsemejlet och på tacksidan.
--
-- Länken bär en slumpad token (32 byte). Bara dess SHA-256-hash sparas här,
-- samma upplägg som bolagsinbjudningarna: en läckt kopia av tabellen räcker
-- inte för att öppna någons uppföljningssida.
--
-- Kolumnen får vara null. Förfrågningar som skickats före den här migrationen
-- har ingen länk, och /api/forfragan/skicka sparar förfrågan utan länk hellre
-- än att avvisa den om kolumnen saknas.
--
-- Ingen ny policy: inquiries läses bara av backend med service role
-- (migration_forfragan_sekretess.sql), och sidan slår upp raden på hashen där.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.

alter table inquiries add column if not exists uppfoljning_token_hash text;

create unique index if not exists inquiries_uppfoljning_token_hash
  on inquiries (uppfoljning_token_hash)
  where uppfoljning_token_hash is not null;

notify pgrst, 'reload schema';
