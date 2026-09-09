const SITE = "https://recruitable.se";

// Sidor som aldrig ska hamna i ett sökresultat: inloggning och konto, allt
// bakom inloggningen, API:erna, underhållssidan och förhandsvisningen.
// Sökträffsidan står med för att den kan varieras i oändlighet med parametrar
// — profilsidorna /bolag/[id] är det som ska hittas, inte sökningen som leder
// dit.
const STANGDA = [
  "/admin",
  "/mina-sidor",
  "/logga-in",
  "/glomt-losenord",
  "/aterstall-losenord",
  "/auth/",
  "/api/",
  "/coming-soon",
  "/forhandsvisning-minasidor",
  "/rekrytera/resultat",
];

// robots.txt hämtas sällan och aldrig i en besökares väg, så den får kosta ett
// anrop per hämtning. Det köper att underhållsläget kan slås på och av utan
// ombyggnad: annars hade en robots.txt från ett gammalt bygge bjudit in
// sökmotorer till en sajt där varje adress svarar "Snart tillbaka" med 200 —
// vilket en crawler läser som riktigt innehåll och kan indexera i stället för
// de riktiga sidorna.
export const dynamic = "force-dynamic";

export default function robots() {
  if (process.env.MAINTENANCE_MODE === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/", disallow: STANGDA },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
