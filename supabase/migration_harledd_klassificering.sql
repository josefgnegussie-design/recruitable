-- Registret innehåller tusentals bolag hämtade ur offentliga register. För dem
-- är yrkesområde och tjänst inte uppgifter bolaget lämnat, utan slutsatser dragna
-- ur bolagsordningens verksamhetsbeskrivning. Träffsäkerheten är uppmätt till
-- 93 procent — alltså har ungefär ett bolag av fjorton fått ett yrkesområde som
-- inte riktigt stämmer.
--
-- Det är hanterbart, men bara om besökaren får veta det. klassificering_harledd
-- markerar de profilerna så att gränssnittet kan visa varifrån uppgiften kommer
-- och bjuda in bolaget att rätta den. Utan markeringen skulle en slutsats se ut
-- som ett bekräftat faktum.
--
-- verksamhetsbeskrivning är bolagets egen formulering ur bolagsordningen, hämtad
-- från Bolagsverket. Den finns för 99 procent av registret och ger varje tunn
-- profil verkligt innehåll utan att någon skriver text åt bolaget.

alter table companies add column if not exists verksamhetsbeskrivning text;
alter table companies add column if not exists klassificering_harledd boolean not null default false;

notify pgrst, 'reload schema';
