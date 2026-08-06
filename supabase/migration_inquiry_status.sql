-- Ger bolagen möjlighet att markera en förfrågan som accepterad eller nekad,
-- så vi kan mäta utfallet strukturerat i vår egen databas.

alter table inquiry_recipients
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'accepted', 'declined'));

alter table inquiry_recipients
  add column if not exists responded_at timestamptz;

-- Verifierade admins får uppdatera status för sitt eget bolags mottagarrader
-- (samma villkor som läs-policyn, men för update).
create policy "Verifierad admin kan sätta status för sitt bolag"
  on inquiry_recipients for update
  using (
    exists (
      select 1 from company_admins
      where company_admins.company_id = inquiry_recipients.company_id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );
