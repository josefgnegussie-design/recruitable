-- Byter ut release-spärren (kontaktuppgifter efter accept) mot en tidigare
-- spärr: en förfrågan syns inte för NÅGOT bolag alls — inte ens redigerad,
-- inte ens att den existerar — förrän Recruitable godkänt den manuellt via
-- /admin/moderera-forfragningar. Så vet vi att avsändaren är seriös och att
-- rätt bolag valts, innan något bolag ens informeras.

alter table inquiries
  add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending', 'approved', 'rejected'));

alter table inquiry_recipients drop column if exists released_at;

-- VIKTIGT: detta stänger samtidigt ett hål som fanns sedan tidigare —
-- RLS-policyerna nedan begränsade bara access via company_id, inte via om
-- förfrågan var godkänd. En bolagsadmin kunde alltså tidigare läsa
-- kontaktuppgifter/förfrågningar direkt via Supabase-klienten i webbläsaren,
-- oavsett vad applikationskoden visade. Nu krävs moderation_status='approved'
-- i själva databasregeln, inte bara i vår egen kod.

drop policy if exists "Verifierad admin ser mottagarrader för sitt bolag" on inquiry_recipients;
create policy "Verifierad admin ser mottagarrader för sitt bolag"
  on inquiry_recipients for select
  using (
    exists (
      select 1 from inquiries
      where inquiries.id = inquiry_recipients.inquiry_id
        and inquiries.moderation_status = 'approved'
    )
    and exists (
      select 1 from company_admins
      where company_admins.company_id = inquiry_recipients.company_id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );

drop policy if exists "Verifierad admin ser förfrågningsinnehåll för sitt bolag" on inquiries;
create policy "Verifierad admin ser förfrågningsinnehåll för sitt bolag"
  on inquiries for select
  using (
    moderation_status = 'approved'
    and exists (
      select 1 from inquiry_recipients
      join company_admins on company_admins.company_id = inquiry_recipients.company_id
      where inquiry_recipients.inquiry_id = inquiries.id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );
