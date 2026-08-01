# Recruitable

Jämför bemannings- och rekryteringsföretag i Sverige — byggd på Next.js (App Router), portad från en tidigare fristående HTML-artefakt.

## Utveckla lokalt

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

## Google Maps-nyckel (för "Hitta bolag i din närhet")

Landningssidans karta (sök på adress → visa bolag inom 25 km) kräver en Google Maps API-nyckel. Utan nyckel visas en platshållartext i stället — resten av sidan fungerar som vanligt.

1. Skapa ett projekt i [Google Cloud Console](https://console.cloud.google.com/) och koppla ett betalkonto (Google har en generös gratiskvot, men kräver fakturering aktiverad).
2. Aktivera **Maps JavaScript API** och **Geocoding API** för projektet.
3. Skapa en API-nyckel under **APIs & Services → Credentials**.
4. Begränsa nyckeln (rekommenderas): under "Application restrictions", välj **HTTP referrers** och lägg till din domän (t.ex. `recruitable.se/*` och `localhost:3000/*` för lokal utveckling).
5. Kopiera `.env.local.example` till `.env.local` och klistra in nyckeln:
   ```bash
   cp .env.local.example .env.local
   ```
6. Starta om `npm run dev`. Vid publicering till Hostinger: kör `npm run build` med `.env.local` på plats (nyckeln bakas in i de statiska filerna vid byggtillfället, eftersom den är avsedd att vara publik och begränsad via referrer-regler ovan).

## Bygga för publicering

Projektet är konfigurerat för **statisk export** (`output: "export"` i `next.config.mjs`) — det byggs till rena HTML/CSS/JS-filer utan att kräva en Node.js-server på webbhotellet:

```bash
npm run build
```

Resultatet hamnar i `out/`.

## Publicera på Hostinger

1. Kör `npm run build` (se ovan).
2. Öppna Hostinger **hPanel → Filhanteraren** (eller anslut via FTP).
3. Gå till mappen för din domän, vanligtvis `public_html/`.
4. Ladda upp **innehållet i** `out/`-mappen (inte själva `out`-mappen) till `public_html/`, så att `index.html` hamnar direkt i `public_html/`.
5. Peka domänen mot detta webbhotellkonto i Hostinger om det inte redan är gjort.

Sidan fungerar sedan helt utan serverkörning — precis som vilken statisk webbplats som helst.

## Projektstruktur

- `app/` — sidor (App Router): `/`, `/bolag`, `/bolag/[id]`, `/matcha`, `/partners`, `/partners/resultat`
- `components/` — delade UI-komponenter, inklusive `wizard/` för matchningsflödets sex steg
- `lib/` — bolagsdata (inkl. geokodade lat/lng-koordinater), yrkesområden/län-taxonomi och GFL-beräkningen (bemanningsavtalet § 5)
- `public/logos/` — inbäddade bolagslogotyper
