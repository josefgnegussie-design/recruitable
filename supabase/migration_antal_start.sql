-- Antal personer och önskad start på en förfrågan.
--
-- AI-sökningen på startsidan tolkar dem ur besökarens text, och köparen kan
-- ändra dem i förfrågans steg 2. Bolagen ser dem som etiketter bredvid
-- yrkesområde och tjänst. Båda är valfria.
--
-- start_tid är text och inte ett datum: köparen väljer "Snarast" eller en månad
-- ("Januari 2027"), och det är just det beskedet bolagen ska läsa.
--
-- Förfrågningar sparas även om migrationen inte körts, då utan de två fälten
-- (se lib/forfraganSkickas.js).

alter table inquiries add column if not exists antal_personer integer
  check (antal_personer is null or antal_personer between 1 and 500);
alter table inquiries add column if not exists start_tid text
  check (start_tid is null or char_length(start_tid) <= 40);
