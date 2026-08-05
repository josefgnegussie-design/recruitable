-- Ersätter det tidigare yrkes-fältet (claimed_roles) med ett enklare
-- tjänste-fält: bolaget anger bara vilka yrkesområden de rekryterar
-- inom (claimed_focus_areas, redan tillagd) samt om de jobbar med
-- Bemanning/Rekrytering/Interim.

alter table company_admins add column if not exists claimed_services text[] not null default '{}';
