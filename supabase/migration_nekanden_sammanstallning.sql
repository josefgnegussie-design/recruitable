-- Nekanden samlas ihop i stället för att skickas ett och ett.
--
-- Bakgrund: när ett bolag svarar får kunden ett besked. Vid accept är det rätt
-- att skicka direkt — kunden ska veta att någon hör av sig. Vid nej är det fel:
-- den som frågat tio bolag får tio nej i rad i inkorgen, var och en en liten
-- besvikelse, och ingen av dem säger något om helheten.
--
-- I stället samlas nekandena ihop och skickas som en sammanställning en gång per
-- dygn: "tre av fem har tackat nej, två har inte svarat än". Ett bolag som dröjer
-- längre än så kommer med i nästa dygns sammanställning.
--
-- Kolumnen är markören för vad som redan rapporterats. Null betyder "nekat men
-- kunden vet inte än" — det är den mängd jobbet arbetar med.

alter table inquiry_recipients add column if not exists decline_reported_at timestamptz;

-- Partiellt index: jobbet frågar efter precis de här raderna varje natt, och de
-- är få. Raderna som redan rapporterats indexeras inte alls.
create index if not exists inquiry_recipients_orapporterade_nekanden_idx
  on inquiry_recipients (responded_at)
  where status = 'declined' and decline_reported_at is null;

-- Befintliga nekanden räknas som redan rapporterade. De skickades ett och ett
-- enligt den gamla ordningen, och kunden ska inte få en sammanställning över
-- besked hon redan fått.
update inquiry_recipients
set decline_reported_at = responded_at
where status = 'declined' and decline_reported_at is null;

notify pgrst, 'reload schema';
