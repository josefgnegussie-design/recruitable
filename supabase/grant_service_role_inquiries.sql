-- Samma bugg som tidigare (se grant_service_role.sql): "alter default
-- privileges" gäller bara tabeller skapade av samma roll som körde den
-- kommandot, så de nya tabellerna inquiries/inquiry_recipients fick
-- aldrig service_role sina grundrättigheter. Kör om grant-satserna
-- explicit så de täcker alla tabeller som finns just nu.
--
-- Kör i Supabase SQL Editor.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
