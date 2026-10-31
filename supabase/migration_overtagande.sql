-- ============================================================
-- Automatiskt övertagande av bolag
--
-- Den som registrerar sig med en mejladress på domänen i bolagets webbplats i
-- registret blir ägare av bolaget så snart adressen är bekräftad. Övriga
-- ansökningar går till granskningskön som förut.
--
-- full_name           namnet ur formuläret, som tidigare inte sparades
-- claimed_company_id  bolaget i registret som ansökan gäller; company_id sätts
--                     först när kontot aktiverats
-- auto_godkann        domänen matchade, aktiveras vid bekräftat mejl
-- godkand_at/_av      när och hur kontot blev aktivt: 'automatiskt' eller
--                     granskarens mejladress
--
-- Bara nya kolumner, så migrationen ska köras FÖRE deploy: koden läser dem.
-- ============================================================
alter table company_admins add column if not exists full_name text;
alter table company_admins add column if not exists claimed_company_id integer references companies(id) on delete set null;
alter table company_admins add column if not exists auto_godkann boolean not null default false;
alter table company_admins add column if not exists godkand_at timestamptz;
alter table company_admins add column if not exists godkand_av text;

create index if not exists company_admins_automatiska_idx
  on company_admins (godkand_at desc)
  where godkand_av = 'automatiskt';
