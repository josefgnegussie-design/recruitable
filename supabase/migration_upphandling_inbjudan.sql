-- Upphandling som inbjudan: köparen väljer ut bolag och bjuder in dem, och
-- inbjudan går samma väg som en förfrågan från Rekrytera (granskning,
-- inquiry_recipients, accept eller nej på Mina sidor, upplåsning vid accept).
--
-- Det enda som behövs är en kolumn för det en upphandling har utöver en vanlig
-- förfrågan: flera orter och yrkesområden, kompetenser, krav, avtalstid, volym
-- och önskat svarsdatum. Null för vanliga förfrågningar.
--
-- Inga nya policyer: inquiries läses bara med service role, och vad ett bolag
-- ser innan accept avgörs av mapInquiryRow i lib/inquiries.js. Kolumnen bär
-- inga uppgifter om vem köparen är.
--
-- Kör i Supabase: Project → SQL Editor → New query → klistra in → Run.
-- Utan migrationen sparas inbjudningar ändå, med detaljerna som text i
-- description.

alter table inquiries add column if not exists upphandling jsonb;

notify pgrst, 'reload schema';
