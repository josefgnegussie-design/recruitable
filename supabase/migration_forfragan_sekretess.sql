-- Stäng bolagens direktläsning av förfrågningarnas innehåll.
--
-- Bakgrund: betalningen är knuten till leaden. Ett bolag ska därför inte kunna
-- se vem som frågar förrän de accepterat. Gränsen drogs i mapInquiryRow, som
-- bara skickar förnamn och roll till klienten — men den gränsen låg i
-- JAVASCRIPT, och raden var läsbar ändå.
--
-- Policyn nedan gav varje verifierad bolagsadmin select på HELA inquiries-raden
-- för sitt bolag. RLS kan inte begränsa kolumner (samma sak som stoppade oss i
-- offices, där en update-policy hade låtit bolaget sätta paid = true på sig
-- självt). Med sin egen inloggning och den publika nyckeln kunde alltså vem som
-- helst med ett bolagskonto hämta requester_company, requester_email och
-- requester_phone direkt från PostgREST och hoppa över oss helt — utan att
-- acceptera, och utan att det syntes någonstans.
--
-- Efter det här läses förfrågningarnas innehåll bara av vår egen backend med
-- service role, som redan kontrollerar att anroparen är verifierad admin för
-- mottagande bolag och som plockar bort de låsta fälten innan svaret går ut:
--   app/mina-sidor/page.js
--   app/api/mina-sidor/forfragan-lista
--   app/api/mina-sidor/forfragan-detaljer   (låser upp efter accept)
--   app/api/mina-sidor/forfragan-status
--
-- inquiry_recipients rörs INTE. Den raden säger bara att ett bolag fått en
-- förfrågan och vad de svarat — inget om kunden — och bolagets egen läsning av
-- den är grunden för att de ska kunna se sin egen status.
--
-- Kör i Supabase SQL Editor.

drop policy if exists "Verifierad admin ser förfrågningsinnehåll för sitt bolag" on inquiries;

-- Kontroll: listar de policyer som finns kvar på inquiries. Efter körningen ska
-- INGEN rad här ha kommandot select eller all för rollen authenticated eller
-- PUBLIC — finns en sådan är läckan öppen igen.
select polname as policy,
       case polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update'
                   when 'd' then 'delete' when '*' then 'all' else polcmd::text end as kommando,
       case when polroles = '{0}'::oid[] then 'PUBLIC'
            else (select string_agg(rolname::text, ', ') from pg_roles where oid = any (polroles))
       end as roller
from pg_policy
where polrelid = 'public.inquiries'::regclass
order by policy;

notify pgrst, 'reload schema';
