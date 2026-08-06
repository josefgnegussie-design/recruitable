-- Extra manuell granskningsspärr: kontaktuppgifter (namn, mejl, roll) släpps
-- inte automatiskt bara för att ett bolag klickat "Acceptera" — Recruitable
-- måste dessutom aktivt släppa dem via /admin/forfragningar. released_at är
-- NULL tills dess.
alter table inquiry_recipients
  add column if not exists released_at timestamptz;
