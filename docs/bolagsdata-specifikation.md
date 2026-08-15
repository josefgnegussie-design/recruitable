# Datapunktsspecifikation: Bolagsprofiler på Recruitable

**Syfte:** Definiera exakt vilka datapunkter plattformen behöver samla in om varje rekryterings-/bemanningsföretag i Sverige, uppdelat i vad som kan hämtas automatiskt vid lansering ("Seed") och vad bolagen själva fyller i när de gör anspråk på sin profil ("Claimed"). Dokumentet är underlag för databasschema och API-integrationer.

**Modellfilosofi:** Seed-data ger plattformen ett fullständigt, sökbart register från dag ett — även bolag som aldrig loggar in ska synas med korrekt grundinformation. Claimed-data är det som gör en profil säljande och sökbar på djupet (nischer, bevis, RFQ-villkor); den kan bara komma från bolaget själva och ska tydligt visuellt skiljas från oclaimed profiler ("Gör anspråk på denna profil"-CTA).

**Notation:** Rader märkta *(Finns redan)* pekar mot fält som redan existerar i `lib/companies.js` eller `companies`-tabellen i Supabase-schemat, så ni ser var det nya bygger vidare på det befintliga.

---

## Föreslagen tabellstruktur

Två tabeller, inte en — seed-data ska kunna skrivas om vid nästa scraping-körning utan att riskera att skriva över ett bolags egna redigeringar:

- **`companies`** — seed-fälten (skrivs av batch-jobb/import), plus ett fåtal styrfält: `claimed_at`, `claimed_by_user_id`, `moderation_status`.
- **`company_profiles`** — claimed-fälten, en rad per bolag, skapas först när bolaget gör anspråk. `1:1` mot `companies.id`.

Detta håller isär "sanning enligt Bolagsverket" från "vad bolaget vill visa upp", vilket också gör det enkelt att visa ett tydligt "ej verifierad av bolaget"-badge på oclaimed profiler.

---

## 1. AUTOMATISK BASDATA (Seed-data)

### A. Grundläggande bolagsinformation

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Bolagsnamn (juridiskt) | String | Obligatoriskt | Officiellt registrerat namn. Bas för sök, visning, matchning mot org.nr. *(Finns redan: `name`)* | Bolagsverket |
| Organisationsnummer | String (`XXXXXX-XXXX`) | Obligatoriskt | Unik identifierare för dedupe, juridisk verifiering och koppling mot kreditdata (UC). Saknas idag i modellen — kritiskt att lägga till innan skalning bortom enstaka bolag. | Bolagsverket |
| Bolagsform | Enum: `AB`, `Handelsbolag`, `Enskild firma`, `Ekonomisk förening`, `Övrigt` | Obligatoriskt | Trovärdighetssignal och filter — de flesta uppdragsgivare vill se `AB`. | Bolagsverket |
| Grundat (år) | Number | Obligatoriskt | Visas som "Grundat 20XX", erfarenhetssignal, sorteringskriterium. *(Finns redan: `founded`)* | Bolagsverket |
| SNI-kod(er) | Array\<String\> | Obligatoriskt | Branschklassificering, används för att förfiltrera vilka bolag som ens är kandidater för registret (SNI 78xxx = personaluthyrning/rekrytering/bemanning). | Bolagsverket / SCB |
| Hemsida (URL) | String | Obligatoriskt för listning | Länk ut från profilkort. Domänen används redan idag för att verifiera att förfrågningar kommer från en äkta motpart — samma logik bör användas för att verifiera bolagets egen domän vid claim. | Webbscraping / manuell research vid seedning |
| Logotyp (bild-URL) | String | Valfritt, ersätts vid claim | Visuell identifiering i listor/kort. *(Finns redan: `logo`)* | Webbscraping (favicon/OG-image) |
| Kort beskrivning (auto) | String (max ~200 tecken) | Valfritt | Fallback-text tills bolaget skriver egen. *(Finns redan: `desc`)* | Scraping av "Om oss"-sida / meta description |

### B. Kontakt & adress

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Besöksadress | String | Obligatoriskt | Visning på profil. *(Finns redan: `address`)* | Bolagsverket / Allabolag |
| Huvudkontor-ort | String | Obligatoriskt | Primärt filter "Ort" i sök. *(Finns redan: `city`)* | Bolagsverket |
| Övriga kontorsorter | Array\<String\> | Valfritt | Grund för multi-ort-filter innan claim ger en mer exakt lista. | Scraping av "Kontor"/"Om oss"-sida |

> Ingen egen rad för koordinater eller generisk telefon/e-post — beslutat 2026-08-14. Lat/lng är inget att samla in, det är ett *beräknat* fält: geokodas automatiskt från Besöksadress (Nominatim) vid varje sparning, precis som idag, så "nära dig"-funktionen i `NearbyCompanies.js` fortsätter fungera utan att koordinater behöver stå med som en egen datapunkt. Växeltelefon/generell e-post ströks helt eftersom kontaktvägen istället går via en namngiven admin per bolagsort (se Claimed B) redan från start — ingen anonym fallback-kontakt behövs.

### C. Finansiell data & storlek

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Omsättning (senaste bokslut) | Number (kr) | Obligatoriskt | Storlekssignal, sortering, hjälper uppdragsgivare matcha uppdragets storlek mot leverantörens. *(Finns redan: `revenue`)* | UC / Allabolag API |
| Omsättningsår | Number | Obligatoriskt | Färskhetsindikator på finansiell data. *(Finns redan: `revenueYear`)* | UC / Allabolag |
| Omsättningstillväxt (YoY %) | Number | Valfritt | Trendsignal, kan driva en "snabbväxare"-badge. | Beräknas från historiska bokslut (UC) |
| Resultat efter finansnetto | Number (kr) | Valfritt | Finansiell hälsa, kompletterar omsättning som storlekssignal. | UC / Allabolag |
| Antal anställda | Number | Obligatoriskt | Kapacitets- och storlekssignal. *(Finns redan: `employees`)* | Bolagsverket (årsredovisning) / UC |
| Anställda-år | Number | Obligatoriskt | Färskhet. *(Finns redan: `employeesYear`)* | Samma källa |
| Kreditvärdighet (UC-rating) | Enum: `AAA`…`C` eller Number | Valfritt | Trygghetssignal för större/dyrare uppdrag, kan gate:a vissa RFQ-flöden. | UC API |
| Storleksband (beräknat) | Enum: `Mikro`, `Litet`, `Medel`, `Stort` | Obligatoriskt | Snabbfilter i sök, beräknas internt från omsättning + antal anställda. *(Finns redan: `sizeBand`)* | Beräknas internt (ej extern källa) |

### D–F, automatiserad bas (minimalt fångbart utan claim)

Nischinfo, förtroendebevis och RFQ-villkor (områdena D, E och F) går i praktiken inte att hämta tillförlitligt utan att bolaget själva bekräftar dem — men två delfält är värda att seeda automatiskt eftersom de finns i offentliga eller lättillgängliga källor:

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Auktoriserat Bemanningsföretag | Boolean | Valfritt | Trovärdighetsbadge — Kompetensföretagens medlemslista är offentlig och scrapebar. *(Finns redan, delvis: `auktorisation`)* | Kompetensföretagens medlemsregister |
| Google-betyg | Number (1,0–5,0) | Valfritt | Sorteringssignal, visas på kort. *(Finns redan: `rating`)* | Google Places API |
| Antal Google-recensioner | Number | Valfritt | Ger betyget kontext (4,8★ på 3 recensioner ≠ 4,2★ på 400). *(Finns redan: `ratingCount`)* | Google Places API |
| Tjänstetyper (best effort) | Array\<Enum\>: `Bemanning`, `Rekrytering`, `Interim`, `Search` | Valfritt, overridas alltid av claimed-värde | Grovt förfilter innan bolaget bekräftat exakt utbud. *(Finns redan: `services`)* | SNI-kod + enkel textanalys av hemsidans innehåll |

---

## 2. UTÖKAD PROFILINFORMATION (Claimed-data)

Allt nedan kräver att en verifierad person hos bolaget gjort anspråk på profilen (samma flöde som `RegisterForm.js`/`company_admins` redan bygger på).

### A. Grundläggande (utökat)

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Redigerad bolagsbeskrivning | String (rich text) | Obligatoriskt vid claim | Ersätter auto-genererad text, visas som huvudpresentation på profilsidan. | Bolaget |
| Cover-/hero-bild | String (bild-URL) | Valfritt | Visuell branding överst på profilsidan. *(Finns redan: `cover_image`)* | Bolaget |
| Vision | String | Valfritt | Employer branding, hjälper uppdragsgivare bedöma kulturell passform. *(Finns redan: `extended_vision`)* | Bolaget |
| Mission | String | Valfritt | Kompletterar vision. *(Finns redan: `mission`)* | Bolaget |
| Historia | String | Valfritt | Trovärdighet/etablering, längre berättande text. *(Finns redan: `history`)* | Bolaget |
| Nyckelpersoner/team | Array\<Object{namn, roll, bild, LinkedIn-URL}\> | Valfritt | Personifiering — "vem möter jag om jag hör av mig". *(Finns redan: `team_members`)* | Bolaget |

### B. Kontakt & adress (utökat)

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Namngiven kontaktperson för förfrågningar | Object{namn, roll, e-post, telefon} | Obligatoriskt vid claim | Vem tar faktiskt emot RFQ:er — direkt koppling till `sendInquiryReceivedToCompany`-flödet i mejlsystemet. | Bolaget |
| Föredragen kontaktmetod | Enum: `E-post`, `Telefon`, `Plattformens formulär` | Valfritt | Styr hur leads levereras och vilken CTA som visas på profilen. | Bolaget |
| Bekräftade verksamhetsorter | Array\<String\> | Valfritt | Överskriver den auto-scrapade listan med en exakt, bolaget-verifierad lista. | Bolaget |

### C. Storlek (kompletterande, ej finansiellt)

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Antal rekryterare/konsultchefer | Number | Valfritt | Kapacitetssignal separat från totalt antal anställda (ett bemanningsföretag kan ha 300 anställda konsulter men bara 8 som faktiskt jobbar med matchning). | Bolaget |
| Antal kontor | Number | Valfritt | Räckviddssignal, kompletterar ortlistan. | Bolaget |

### D. Tjänsteutbud & nischer

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Primära tjänstetyper | Array\<Enum\>: `Bemanning`, `Rekrytering`, `Interim`, `Search`, `RPO`, `Outplacement` | Obligatoriskt vid claim | Huvudfilter i sök, den viktigaste enskilda matchningsdimensionen. *(Finns redan: `services`)* | Bolaget |
| Yrkesområden/branscher | Array\<Enum\> (mot befintlig taxonomi i `lib/taxonomy.js`, 21 områden) | Obligatoriskt vid claim | Huvudfilter i sök. *(Finns redan: `focus`)* | Bolaget |
| Nivå på roller de tillsätter | Array\<Enum\>: `Junior`, `Medior/Specialist`, `Senior`, `Chef/Executive` | Valfritt | Finfilter — skiljer ett bolag som gör juniorbemanning från ett executive search-bolag inom samma bransch. | Bolaget |
| Nischtaggar (fritext) | Array\<String\> | Valfritt | Sökbarhet på specifik spetskompetens (t.ex. "SAP-konsulter", "sjuksköterskebemanning", "fintech-rekrytering"). | Bolaget |
| Geografisk täckning | Enum: `Rikstäckande`, `Regional`, `Lokal` + Array\<String\> (län) | Valfritt | Matchning mot uppdragsgivarens ort även när bolaget saknar lokalt kontor där. | Bolaget |

### E. Förtroendesignaler & bevis

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Certifieringar (branschstandard) | Array\<Enum\>: `ISO 9001`, `ISO 14001`, `ISO 27001`, `ISO 45001` | Valfritt | Filterbar trovärdighetssignal — särskilt relevant vid offentlig upphandling som ofta kravställer just dessa. ISO 27001 (informationssäkerhet) relevant då bolagen hanterar persondata/GDPR, ISO 45001 (arbetsmiljö) vanligt i bemanningsbranschen. | Bolaget (uppladdning av intyg) |
| Certifieringar (övriga, fritext) | Array\<Object{namn, utfärdare, år, intygs-URL}\> | Valfritt | Badges för certifieringar utanför standardlistan (Great Place to Work, branschspecifika intyg). | Bolaget (uppladdning) |
| Kundcase | Array\<Object{kund (ev. anonymiserad), utmaning, resultat}\> | Valfritt | Konkret bevis på leveransförmåga, det starkaste säljargumentet på profilen. | Bolaget |
| Kundomdömen | Array\<Object{namn, företag, citat, betyg}\> | Valfritt | Social proof. Bör modereras av Recruitable innan publicering (samma mönster som redan finns för förfrågningsgranskning). *(Finns redan: `surveys` — bör ses över om det räcker eller behöver bytas ut)* | Bolaget (självrapporterat) |
| Utmärkelser/priser | Array\<String\> | Valfritt | Trovärdighetssignal. | Bolaget |
| Antal genomförda uppdrag (self-reported) | Number | Valfritt | Erfarenhetssignal där omsättning/antal anställda inte räcker som proxy. | Bolaget |

### F. Matchningskriterier för RFQ

| Fältnamn | Datatyp | Obligatoriskt/Valfritt | Beskrivning & användningsområde | Primär datakälla |
|---|---|---|---|---|
| Minsta uppdragsstorlek | Number (kr eller antal roller) | Valfritt | Filtrerar bort orealistiska förfrågningar innan de ens skickas till bolaget. | Bolaget |
| Typisk svarstid | Enum: `< 24 timmar`, `1–3 dagar`, `> 3 dagar` | Valfritt | Förväntningsstyrning för uppdragsgivaren, kan visas som SLA-badge på profilen. | Bolaget |
| Prismodell | Enum: `Fast pris`, `% av årslön`, `Timpris`, `Abonnemang` | Valfritt | Transparens och förfiltrering innan kontakt tas. | Bolaget |
| Garantitid vid rekrytering | Number (månader) | Valfritt | Trygghetssignal ("ersättningsgaranti om personen slutar inom X månader"). | Bolaget |
| Automatisk lead-routing | Boolean | Obligatoriskt vid claim | Styr om plattformen ska skicka förfrågningar direkt till bolaget eller kräva manuellt godkännande av varje inkommande RFQ. | Bolaget (plattformsinställning) |
| Notifieringsinställningar | Object (kanal, mottagare, frekvens) | Obligatoriskt vid claim | Teknisk styrning av vilka mejl som går ut och till vem — kopplar direkt mot `lib/email.js`. | Bolaget |

---

## Datakällor — sammanfattning

| Källa | Vad den ger | Typ av åtkomst |
|---|---|---|
| **Bolagsverket** | Org.nr, bolagsform, status, registreringsdatum, SNI-kod, adress | Offentligt API (Bolagsverkets öppna data) |
| **UC / Allabolag** | Omsättning, resultat, kreditvärdighet, antal anställda | Kommersiellt API, kräver avtal |
| **Nominatim (OpenStreetMap)** | Geokodning adress → lat/lng | Redan integrerat i projektet |
| **Google Places API** | Betyg, antal recensioner, ev. öppettider | Kommersiellt API |
| **Kompetensföretagen** | Medlemslista (auktoriserade bemanningsföretag) | Offentlig lista, scrapebar |
| **Webbscraping (egen domän)** | Logotyp, kort beskrivning, kontorsorter | Egen scraper, kräver underhåll vid sajtändringar |
| **Bolaget själva** | Allt under Claimed-data | Formulär i produkten |

---

## Öppna frågor inför implementation

1. **UC/Allabolag-avtal** — kommersiell finansdata kräver ett betalt API-avtal. Behöver klargöras innan seed-jobbet för kategori C kan byggas.
2. **SNI-baserad förfiltrering** — var ska gränsen dras för vilka SNI-koder som kvalificerar ett bolag för registret, så att t.ex. rena vikariebanker för sjukvård inte blandas med generalist-bemanning om det inte är önskat?
3. **Moderering av kundomdömen** — ska omdömen som bolaget själva lägger in granskas manuellt (samma mönster som förfrågningsgranskningen), eller lita på självrapportering?
4. **Refresh-cykel för seed-data** — hur ofta ska Bolagsverket/UC-data hämtas om (kvartalsvis? vid inloggning? på begäran)? Påverkar om `companies`-tabellen behöver en `seed_updated_at`-kolumn.
