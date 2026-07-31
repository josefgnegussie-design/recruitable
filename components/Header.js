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
          <span className="mark"></span>Recruitable<span className="doc-tag">&nbsp;/ VÄSTRA GÖTALAND</span>
        </Link>
        <nav className="site-nav">
          <Link href="/" className={isLanding ? "active" : ""}>Hem</Link>
          <Link href="/partners" className={isPartners ? "active" : ""}>Partners</Link>
          <span onClick={() => alert("Prototyp: sidan Om Recruitable byggs i nasta steg.")}>Om tjänsten</span>
        </nav>
      </div>
    </header>
  );
}
