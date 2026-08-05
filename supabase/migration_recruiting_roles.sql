-- Steg 3 i registreringen: bolaget anger vilka yrkesområden och yrken de
-- aktivt rekryterar till. Osynliga taggar — visas inte publikt, används bara
-- för framtida matchning. Sparas som "claimed_*" på company_admins tills en
-- människa manuellt godkänner/kopplar kontot, och som de faktiska fälten på
-- companies när bolaget är kopplat.

alter table company_admins add column if not exists claimed_focus_areas text[] not null default '{}';
alter table company_admins add column if not exists claimed_roles text[] not null default '{}';

alter table companies add column if not exists recruiting_focus_areas text[] not null default '{}';
alter table companies add column if not exists recruiting_roles text[] not null default '{}';
