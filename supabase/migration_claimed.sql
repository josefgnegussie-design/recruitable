-- Registret fylls på med bolag hämtade ur offentliga register. De profilerna är
-- med nödvändighet tunna: namn, ort, omsättning, anställda — men ingen logotyp,
-- ingen egen beskrivning och inga yrkesområden, eftersom det inte står i något
-- register.
--
-- claimed skiljer en sådan profil från en som bolaget självt tagit över. På de
-- oövertagna visas en inbjudan att göra det, så att tunnheten blir en uppmaning
-- i stället för ett intryck av att sajten är halvfärdig.
--
-- Sätts till true när en kontoansökan godkänns.

alter table companies add column if not exists claimed boolean not null default false;

notify pgrst, 'reload schema';
