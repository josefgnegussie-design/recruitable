-- Vilket kontor en godkänd förfrågan faktiskt routades till, vilken adress den
-- mejlades till, och när.
--
-- Routningen räknades tidigare ut i minnet vid godkännandet
-- (resolveCompanyContacts i lib/offices.js) och kastades sedan bort. Varken vi
-- eller det betalande bolaget kunde i efterhand se om förfrågan gick till
-- kontorets egen kontaktperson eller till bolagets generella adress — och ett
-- mejl som aldrig gick ut syntes bara som en rad i serverloggen. Det duger inte
-- när kontoret är det man betalar för: kvittot är hela varan.
--
-- office_id är null när förfrågan gick till bolagets generella kontakt, och
-- nollställs om kontoret raderas. Raden ska överleva som kvitto på att ett mejl
-- gick ut, även när kontoret den gick till inte finns kvar.
--
-- notified_at sätts först när utskicket lyckats, inte när det beslutats. Ett
-- misslyckat mejl ska synas som just det: en mottagare med adress men utan tid.

alter table inquiry_recipients
  add column if not exists office_id uuid references offices(id) on delete set null,
  add column if not exists notified_email text,
  add column if not exists notified_at timestamptz;

-- Faktureringsunderlaget frågar "hur många förfrågningar fick kontoret i
-- Falkenberg den här månaden" — alltså uppslag på office_id. Raderna utan
-- kontor är de allra flesta och hör inte hemma i indexet.
create index if not exists inquiry_recipients_office_id_idx
  on inquiry_recipients (office_id)
  where office_id is not null;

-- Inga nya policyer: kolumnerna sätts bara av backend (service role) i
-- /api/admin/moderera-forfragan, och den befintliga select-policyn för
-- verifierade bolagsadmins täcker dem redan. Ett bolag kan alltså se vilken av
-- sina egna adresser som fick förfrågan — aldrig någon annans.

notify pgrst, 'reload schema';
