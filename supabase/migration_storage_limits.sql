-- Hårdnar bildlagringen (company-media): filtyp och storlek kontrolleras
-- hittills bara i klientkoden (lib/uploadImage.js), vilket går att kringgå
-- genom att prata direkt mot Supabase Storage-API:et. Detta sätter samma
-- gränser på bucket-nivå, så de gäller oavsett vilken klient som laddar upp.

update storage.buckets
set
  file_size_limit = 5242880, -- 5 MB, samma som lib/uploadImage.js
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'company-media';
