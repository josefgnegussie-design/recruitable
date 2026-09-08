# Intern dashboard (`/admin`)

Recruitables egen vy: används sajten, leder användningen till förfrågningar, och
vad blev det av dem. Nås bara av adresserna i `PLATFORM_ADMIN_EMAILS`. Loggar en
sådan adress in skickas den från `/mina-sidor` hit automatiskt — det kontot har
inget bolag att administrera.

## Sidor

| Sida | Innehåll |
|---|---|
| `/admin` | Översikt: trafik, sökningar, utfall av förfrågningar, registrets storlek. Period väljs med `?period=7\|30\|90\|365`. |
| `/admin/fakturering` | Underlag per bolag och månad, med CSV-export. |
| `/admin/moderera-forfragningar` | Granskningskön (fanns sedan tidigare). |
| `/admin/kontoansokningar` | Kontoansökningar (fanns sedan tidigare). |
| `/admin/logg` | Loggboken per förfrågan (fanns sedan tidigare). |

## Innan den fungerar

1. **Kör `supabase/migration_statistik.sql`** i Supabase → SQL Editor. Den skapar
   `site_events`, kolumnen `inquiries.moderated_at` och sex statistikfunktioner.
   Tills den körts säger dashboarden det rakt ut istället för att visa nollor —
   en tom vy som egentligen betyder "migrationen kördes aldrig" är precis det
   misstag som en gång bröt registreringen tyst (se
   `supabase/granska_schema.sql`).
2. **Sätt `STATISTIK_SALT`** i Vercel (Production + Preview) till en lång slumpad
   sträng. Utan den räknas sidvisningar ändå, men rutan "Besökare" står tom.
   Värdet får bytas när som helst; det enda som händer är att besökare räknas om
   från och med det dygnet.

## Var siffrorna kommer ifrån

**Förfrågningar** läses direkt ur `inquiries` och `inquiry_recipients` — samma
tabeller som styr vad bolagen faktiskt ser. Ingen parallell statistiktabell som
kan hamna ur synk med verkligheten.

**Trafik** finns inte någon annanstans hos oss och har därför en egen tabell,
`site_events`. Mätningen är cookielös: ingen IP-adress och ingen user agent
sparas. `visitor_hash` är en envägshash av `STATISTIK_SALT` + dagens datum + IP +
user agent, som byter värde vid midnatt — den skiljer en besökare som läser tio
sidor från tio besökare, men går inte att följa mellan dygn. Robotar filtreras på
user agent innan raden skrivs. Google Analytics ligger kvar oförändrat vid sidan
av; skillnaden är att GA bara mäter dem som accepterat cookies.

Sidvisningar skickas från `components/Sidvisningar.js` till
`/api/statistik/handelse`. Sökningar loggas serversidan i `/api/bolag/sok`, bara
för första sidan av en sökning med minst ett filter.

## Faktureringsunderlaget

Ett *utskick* är en rad i `inquiry_recipients`: en godkänd förfrågan × ett
mottagande bolag. Varje utskick är antingen accepterat, nekat eller obesvarat.

Två regler avgör vad som räknas:

- **Bara godkända förfrågningar.** En förfrågan som nekats i granskningen har
  aldrig nått något bolag och finns inte med i underlaget.
- **Månaden räknas från `moderated_at`**, alltså när förfrågan godkändes och blev
  synlig för bolaget — inte när avsändaren skrev den. En förfrågan som kommer in
  den 31:a och godkänns den 1:a hör till den nya månaden.

Underlaget innehåller inga priser. Antalen är facit; priset sätts när fakturan
skrivs. Ett pris i koden hade behövt hållas i synk med avtalen, och den synken
finns det inget som bevakar.
