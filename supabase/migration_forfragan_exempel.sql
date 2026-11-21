-- Pågående förfrågningar på /rekrytera: beställaren kan säga ja till att
-- förfrågan visas anonymt (ort, tjänst, yrkesområde och hur långt den kommit).
-- Förvalt nej för allt som redan skickats, eftersom ingen tillfrågats.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.
-- Utan migrationen sparas förfrågningar ändå, och sidan visar bara exempel.

alter table inquiries add column if not exists visa_som_exempel boolean not null default false;

notify pgrst, 'reload schema';
