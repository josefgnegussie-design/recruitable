-- Ägarskap för ett bolagskonto.
--
-- Bakgrund: company_admins har hittills rymt en rad per bolag, så frågan om
-- vem som ansvarar för prenumerationen har aldrig ställts — det fanns bara en
-- kandidat. Så fort ett bolag kan ha flera administratörer, vilket är hela
-- poängen när kontorschefer ska in, kan vem som helst av dem öppna Stripes
-- portal och säga upp abonnemanget. Den bristen uppstår i samma stund som den
-- andra administratören läggs till, inte vid en överlåtelse.
--
-- Ägaren är den som svarar för prenumerationen och den enda som får lägga till
-- eller ta bort administratörer. Ägarskapet går att lämna över till en annan
-- administratör i samma bolag.

alter table company_admins add column if not exists ar_agare boolean not null default false;

-- Högst en ägare per bolag, upprätthållet av databasen och inte bara av koden.
-- Partiellt index: raderna med ar_agare = false berörs inte alls.
create unique index if not exists company_admins_en_agare_per_bolag
  on company_admins (company_id)
  where ar_agare;

-- Befintliga konton: den först godkända administratören i varje bolag blir
-- ägare. Säker att köra om — sätter bara ägare för bolag som saknar en.
with forsta as (
  select distinct on (company_id) id
  from company_admins
  where verified and company_id is not null
    and company_id not in (select company_id from company_admins where ar_agare and company_id is not null)
  order by company_id, created_at asc, id asc
)
update company_admins set ar_agare = true
where id in (select id from forsta);

notify pgrst, 'reload schema';
