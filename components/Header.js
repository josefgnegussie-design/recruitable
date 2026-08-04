"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isPartners = pathname.startsWith("/partners");
  const isBolag = pathname.startsWith("/bolag");
  const isOmOss = pathname.startsWith("/om-oss");
  const isLoggaIn = pathname.startsWith("/logga-in");

  if (pathname === "/coming-soon") return null;

  return (
    <header className="site">
      <div className="header-inner">
        <Link className="logo" href="/" style={{ cursor: "pointer" }}>
          <span className="mark"></span>Recruitable
        </Link>
        <nav className="site-nav">
          <Link href="/" className={isLanding ? "active" : ""}>Hem</Link>
          <Link href="/partners" className={isPartners ? "active" : ""}>Rekrytera</Link>
          <Link href="/bolag" className={isBolag ? "active" : ""}>Bolag</Link>
          <Link href="/om-oss" className={isOmOss ? "active" : ""}>Om oss</Link>
          <Link href="/logga-in" className={isLoggaIn ? "active" : ""}>Logga in</Link>
        </nav>
      </div>
    </header>
  );
}
