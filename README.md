# Recruitable

Jämför bemannings- och rekryteringsföretag i Västra Götaland — bygg på Next.js (App Router), portad från en tidigare fristående HTML-artefakt.

## Utveckla lokalt

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

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
- `lib/` — bolagsdata, yrkesområden/län-taxonomi och GFL-beräkningen (bemanningsavtalet § 5)
- `public/logos/` — inbäddade bolagslogotyper
