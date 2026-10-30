-- Nya yrkesområden: från Arbetsförmedlingens 21 till de 17 som bemannings- och
-- rekryteringsbolag faktiskt tillsätter (se kommentaren över YRKESOMRADEN i
-- lib/taxonomy.js).
--
-- Sökningen filtrerar med `contains("focus", [område])` och rullistan erbjuder
-- bara de nya namnen. Ett bolag som ligger kvar med ett gammalt namn hittas
-- därför inte längre på något område alls — översättningen måste göras i
-- databasen samtidigt som koden går ut.
--
-- Översättningen:
--   * De flesta områden får bara ett nytt namn.
--   * "Administration, ekonomi, juridik" blir både "Administration och kontor"
--     och "Ekonomi och finans", eftersom det gamla området rymde båda.
--   * "Hantverk" går till "Industri och tillverkning" och "Naturvetenskap" till
--     "Teknik och ingenjörer", där deras yrken nu ligger.
--   * Kropps- och skönhetsvård, Kultur/media/design, Militära yrken, Naturbruk,
--     Sanering och renhållning samt Säkerhet och bevakning utgår. Bolag som
--     bara hade sådana områden blir utan område och får välja nya själva.
--
-- Migreringen går att köra flera gånger: nya namn översätts till sig själva.

begin;

create temporary table yrkesomrade_oversattning (gammalt text not null, nytt text) on commit drop;

insert into yrkesomrade_oversattning (gammalt, nytt) values
  ('Administration, ekonomi, juridik', 'Administration och kontor'),
  ('Administration, ekonomi, juridik', 'Ekonomi och finans'),
  ('Bygg och anläggning',              'Bygg och anläggning'),
  ('Chefer och verksamhetsledare',     'Chefer och ledning'),
  ('Data/IT',                          'IT'),
  ('Försäljning, inköp, marknadsföring','Försäljning och kundtjänst'),
  ('Hantverk',                         'Industri och tillverkning'),
  ('Hotell, restaurang, storhushåll',  'Hotell, restaurang och storkök'),
  ('Hälso- och sjukvård',              'Hälso- och sjukvård'),
  ('Industriell tillverkning',         'Industri och tillverkning'),
  ('Installation, drift, underhåll',   'El, installation och underhåll'),
  ('Kropps- och skönhetsvård',         null),
  ('Kultur, media, design',            null),
  ('Militära yrken',                   null),
  ('Naturbruk',                        null),
  ('Naturvetenskap',                   'Teknik och ingenjörer'),
  ('Pedagogik',                        'Skola och förskola'),
  ('Sanering och renhållning',         null),
  ('Säkerhet och bevakning',           null),
  ('Transport, distribution, lager',   'Lager, logistik och transport'),
  ('Yrken med social inriktning',      'Omsorg och socialt arbete'),
  ('Yrken med teknisk inriktning',     'Teknik och ingenjörer');

-- Översätter en lista. Namn som inte finns i tabellen (alltså redan nya) behålls.
-- Ordningen bevaras och dubbletter tas bort.
create or replace function pg_temp.oversatt_omraden(gamla text[]) returns text[]
language sql stable as $$
  select coalesce(array_agg(namn order by forsta), '{}')
  from (
    select namn, min(ord) as forsta
    from (
      select coalesce(o.nytt, case when o.gammalt is null then g.namn end) as namn, g.ord
      from unnest(gamla) with ordinality as g(namn, ord)
      left join yrkesomrade_oversattning o on o.gammalt = g.namn
    ) x
    where namn is not null
    group by namn
  ) y
$$;

update companies
   set focus = pg_temp.oversatt_omraden(focus)
 where focus && (select array_agg(distinct gammalt) from yrkesomrade_oversattning where gammalt is distinct from nytt);

update company_admins
   set claimed_focus_areas = pg_temp.oversatt_omraden(claimed_focus_areas)
 where claimed_focus_areas && (select array_agg(distinct gammalt) from yrkesomrade_oversattning where gammalt is distinct from nytt);

-- Förfrågningar är historik, men visas i mejl och i adminvyn. Utgångna områden
-- lämnas som de är, så att det syns vad förfrågan faktiskt gällde.
update inquiries i
   set focus_area = o.nytt
  from (select distinct on (gammalt) gammalt, nytt
          from yrkesomrade_oversattning
         where nytt is not null and gammalt <> nytt
         order by gammalt, nytt) o
 where i.focus_area = o.gammalt;

commit;
