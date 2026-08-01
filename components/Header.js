"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isPartners = pathname.startsWith("/partners");

  return (
    <header className="site">
      <div className="header-inner">
        <Link className="logo" href="/" style={{ cursor: "pointer" }}>
          <span className="mark"></span>Recruitable
        </Link>
        <nav className="site-nav">
          <Link href="/" className={isLanding ? "active" : ""}>Hem</Link>
          <Link href="/partners" className={isPartners ? "active" : ""}>Partners</Link>
          <span onClick={() => alert("Prototyp: sidan Om oss byggs i nasta steg.")}>Om oss</span>
          <span onClick={() => alert("Prototyp: inloggning byggs i nasta steg.")}>Logga in</span>
        </nav>
      </div>
    </header>
  );
}
