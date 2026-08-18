-- Respitperiod för premium: skiljer "kunden har slutat betala" från
-- "kundens kort gick inte igenom i förnyelsen".
--
-- Tidigare släcktes is_premium så fort Stripe satte prenumerationen till
-- past_due, vilket händer redan vid första misslyckade dragningen. Kunden
-- är då fortfarande kund — Stripe fortsätter försöka i dagar — men den
-- utökade profilen försvann direkt.
--
-- premium_until sätts till periodens slut plus respit och används för att
-- upptäcka prenumerationer som fastnat: is_premium = true men premium_until
-- passerad betyder att ett avslutsevent aldrig kom fram. Kolumnen styr
-- alltså inte visningen, den är facit för bevakningen.
--
-- Kör i Supabase SQL Editor.

alter table companies add column if not exists premium_until timestamptz;

comment on column companies.premium_until is
  'Betald periods slut + respitdagar. Sätts av Stripe-webhooken. Används av /api/cron/premium-koll för att hitta premium som fastnat.';

-- Bakåtfyllnad: befintliga premiumbolag får en generös respit så att
-- bevakningen inte larmar för rader som sattes innan kolumnen fanns.
update companies
   set premium_until = now() + interval '30 days'
 where is_premium = true
   and premium_until is null;
