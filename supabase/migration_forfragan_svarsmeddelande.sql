-- Bolagets egna ord när de svarar på en förfrågan.
--
-- Bakgrund: när ett bolag accepterar eller nekar får kunden numera ett besked
-- per mejl. Ett rent "tyvärr, de tackade nej" är en sämre upplevelse än det
-- behöver vara — bolaget vet oftast VARFÖR ("vi har inte kapacitet i Kiruna
-- förrän i mars"), och den meningen är värd mer för kunden än beskedet självt.
--
-- Meddelandet sparas och skickas inte bara vidare, av två skäl: det ska gå att
-- se i efterhand vad som faktiskt sades i vårt namn, och loggboken ska kunna
-- visa hela kedjan från förfrågan till svar.
--
-- Taket är 30 ord, satt i koden (raknaOrd i lib/inquiries.js) och inte som en
-- kolumnbegränsning — ord går inte att räkna i en check-constraint utan att
-- upprepa reglerna på ett andra ställe. Textlängden begränsas ändå här som
-- skydd mot en klient som struntar i formuläret.

alter table inquiry_recipients add column if not exists response_message text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inquiry_recipients_response_message_langd') then
    alter table inquiry_recipients add constraint inquiry_recipients_response_message_langd
      check (response_message is null or char_length(response_message) <= 400);
  end if;
end $$;

notify pgrst, 'reload schema';
