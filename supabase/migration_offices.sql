-- Kontor: en betalningsbar underenhet till ett bolag. Jovi Konsult AB
-- förblir en (1) sökbar rad i companies, men kan ha flera kontor
-- (Göteborg, Falkenberg, Skövde). Varje ytterligare kontor utöver
-- huvudkontoret är en egen betald plats — när det är betalt routas
-- godkända förfrågningar från den orten till kontorets egen kontaktperson
-- istället för till bolaget generellt. Se sendInquiryReceivedToCompany i
-- lib/email.js och /api/stripe/skapa-kontor-checkout.
--
-- company_admins.office_id är förberedd för när ett kontor ska kunna ha
-- en egen inloggad admin (inte bara en kontakt-e-post) — inget i dagens
-- kod sätter den kolumnen än, men den finns på plats så migreringen inte
-- behöver göras om senare.

create table if not exists offices (
  id uuid primary key default gen_random_uuid(),
  company_id integer not null references companies(id) on delete cascade,
  city text not null,
  address text,
  contact_name text,
  contact_email text,
  is_headquarters boolean not null default false,

  -- Betalning — samma mönster som companies.is_premium/stripe_*, sätts
  -- bara av webhooken (service role), aldrig direkt av klienten.
  paid boolean not null default false,
  stripe_subscription_id text,
  stripe_checkout_session_id text,

  created_at timestamptz not null default now()
);

alter table company_admins add column if not exists office_id uuid references offices(id) on delete set null;

alter table offices enable row level security;

-- Öppen läsning, precis som companies — vilka orter ett bolag finns på
-- är del av den publika profilen.
create policy "Publik läsåtkomst till kontor"
  on offices for select
  using (true);

-- Inga insert/update/delete-policyer för inloggade användare — nya
-- kontor skapas och markeras betalda bara via backend (service role),
-- som en del av Stripe-checkout-flödet. Samma resonemang som för
-- company_admins och companies.is_premium.
