-- Riktiga förfrågningsflödet från Rekrytera-sidan: en besökare filtrerar
-- fram bolag, väljer vilka som är intressanta, beskriver rollen och
-- verifierar sig, och de valda bolagen får förfrågan sparad på sina
-- "Mina sidor" under fliken "Förfrågningar". Inget mejl skickas ännu.

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),

  -- Vad besökaren sökte på (för sammanhang, inte strikt filtrering)
  search_role text,
  focus_area text,
  service text,
  region text,
  city text,
  require_ka boolean not null default false,
  require_auktorisation boolean not null default false,

  -- Beskrivning av behovet
  description text not null,

  -- Besökarens egna, verifierade uppgifter
  requester_name text not null,
  requester_email text not null,
  requester_website text not null,
  requester_role text not null,
  requester_company text not null,
  requester_city text not null,

  created_at timestamptz not null default now()
);

create table if not exists inquiry_recipients (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries(id) on delete cascade,
  company_id integer not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (inquiry_id, company_id)
);

alter table inquiries enable row level security;
alter table inquiry_recipients enable row level security;

-- Inga publika läs/skriv-policyer — allt skapas via backend med
-- service role-nyckeln (efter domänkontroll), som resten av registret.
-- Verifierade bolagsadmins får läsa förfrågningarna som gäller deras eget bolag.
create policy "Verifierad admin ser mottagarrader för sitt bolag"
  on inquiry_recipients for select
  using (
    exists (
      select 1 from company_admins
      where company_admins.company_id = inquiry_recipients.company_id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );

create policy "Verifierad admin ser förfrågningsinnehåll för sitt bolag"
  on inquiries for select
  using (
    exists (
      select 1 from inquiry_recipients
      join company_admins on company_admins.company_id = inquiry_recipients.company_id
      where inquiry_recipients.inquiry_id = inquiries.id
        and company_admins.user_id = auth.uid()
        and company_admins.verified = true
    )
  );
