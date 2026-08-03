-- Lägger till fält som saknas för den utökade premiumprofilen, samt
-- sätter upp bildlagring (Supabase Storage) för omslagsbilder, loggor
-- och medarbetarfoton.
--
-- Kör i Supabase SQL Editor.

-- companies.logo och companies.team_members/surveys/extended_vision
-- finns redan sedan tidigare (se schema.sql). Lägger bara till omslagsbild:
alter table companies add column if not exists cover_image text;

-- ============================================================
-- STORAGE: bucket för bolagens bilder (omslag, logga, medarbetarfoton)
-- Publik läsning (bilderna ska synas för alla besökare), men bara
-- verifierade admins får ladda upp/ändra/radera i sitt eget bolags mapp.
-- Filsökväg-konvention: <company_id>/<valfritt filnamn>
-- ============================================================
insert into storage.buckets (id, name, public)
values ('company-media', 'company-media', true)
on conflict (id) do nothing;

create policy "Publik läsning av bolagsbilder"
  on storage.objects for select
  using (bucket_id = 'company-media');

create policy "Verifierad admin kan ladda upp till sitt eget bolags mapp"
  on storage.objects for insert
  with check (
    bucket_id = 'company-media'
    and exists (
      select 1 from company_admins
      where company_admins.user_id = auth.uid()
        and company_admins.verified = true
        and company_admins.company_id::text = (storage.foldername(name))[1]
    )
  );

create policy "Verifierad admin kan uppdatera sitt eget bolags bilder"
  on storage.objects for update
  using (
    bucket_id = 'company-media'
    and exists (
      select 1 from company_admins
      where company_admins.user_id = auth.uid()
        and company_admins.verified = true
        and company_admins.company_id::text = (storage.foldername(name))[1]
    )
  );

create policy "Verifierad admin kan radera sitt eget bolags bilder"
  on storage.objects for delete
  using (
    bucket_id = 'company-media'
    and exists (
      select 1 from company_admins
      where company_admins.user_id = auth.uid()
        and company_admins.verified = true
        and company_admins.company_id::text = (storage.foldername(name))[1]
    )
  );
