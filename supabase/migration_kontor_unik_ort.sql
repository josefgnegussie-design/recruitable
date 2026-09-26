-- Ett kontor per ort och bolag.
--
-- Utan den här regeln kunde samma bolag ha två kontor i Falkenberg, och
-- resolveCompanyContacts (lib/offices.js) tog då "det första" som kom tillbaka
-- ur frågan — utan order by, alltså slumpen. Vilken kontaktperson som fick
-- ortens förfrågningar var därmed inte något bolaget kunde styra över, trots
-- att det är precis det de betalar för.
--
-- Regeln gäller även obetalda rader: en avbruten kassa lämnar kvar ett obetalt
-- kontor, och nästa försök på samma ort ska fortsätta på den raden i stället
-- för att skapa en till. /api/stripe/skapa-kontor-checkout gör det numera.
--
-- offices.city är sedan 2026-09-13 låst till kommunlistan (kanoniskOrt i
-- lib/helpers.js), så namnen är redan normaliserade när de når hit — jämförelsen
-- behöver ingen lower().
--
-- Tabellen var tom i produktion när indexet skrevs. Skulle det ändå finnas
-- dubbletter avbryts bygget, och de måste rensas först:
--   select company_id, city, count(*) from offices
--   group by company_id, city having count(*) > 1;

create unique index if not exists offices_company_city_unik
  on offices (company_id, city);

notify pgrst, 'reload schema';
