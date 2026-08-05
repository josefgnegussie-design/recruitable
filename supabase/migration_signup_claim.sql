-- Stöd för tvåstegsregistrering: bolaget behöver inte längre finnas i
-- companies-registret sedan innan. company_id blir valfri, och vi sparar
-- det den registrerande personen själv angav (namn, org.nr, adress) tills
-- en människa manuellt matchar/skapar bolaget och godkänner kontot.

alter table company_admins alter column company_id drop not null;
alter table company_admins add column if not exists claimed_company_name text;
alter table company_admins add column if not exists claimed_org_number text;
alter table company_admins add column if not exists claimed_address text;
alter table company_admins add column if not exists claimed_website text;

alter table companies add column if not exists org_number text;
