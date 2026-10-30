import Link from "next/link";

// Renderas en gång i app/layout.js, så att varje sida får samma sidfot. Den
// döljs på underhållssidan via coming-soon.css, av samma skäl som headern.
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>RECRUITABLE — BEMANNING &amp; REKRYTERING</div>
        <Link href="/integritetspolicy">Integritetspolicy</Link>
        <Link href="/kontakt">Kontakt</Link>
        <div>Data kontrollerad augusti 2026 · Prototyp</div>
      </div>
    </footer>
  );
}
