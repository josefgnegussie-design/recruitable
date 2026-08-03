-- Bryter ut det tidigare enda "utökad vision"-fältet i fler separata
-- sektioner för profilredigeraren.
-- Kör i Supabase SQL Editor.

alter table companies add column if not exists mission text;
alter table companies add column if not exists history text;
alter table companies add column if not exists expertise text;
