import Link from "next/link";

// Renderas en gång i app/layout.js, så att varje sida får samma sidfot. Den
// döljs på underhållssidan via coming-soon.css, av samma skäl som headern.
//
// Datumet för senaste kontroll står kvar: det är ett förtroendetecken för en
// tjänst som bygger på att uppgifterna stämmer.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-namn">
          <span className="mark"></span>Recruitable
        </div>
        <nav className="footer-lankar" aria-label="Sidfot">
          <Link href="/om-oss">Om oss</Link>
          <Link href="/kontakt">Kontakt</Link>
          <Link href="/integritetspolicy">Integritetspolicy</Link>
        </nav>
        <div className="footer-data">Uppgifterna kontrollerade augusti 2026</div>
      </div>
    </footer>
  );
}
