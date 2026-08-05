"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLanding = pathname === "/";
  const isRekrytera = pathname.startsWith("/rekrytera");
  const isBolag = pathname.startsWith("/bolag");
  const isOmOss = pathname.startsWith("/om-oss");
  const isLoggaIn = pathname.startsWith("/logga-in");

  if (pathname === "/coming-soon") return null;

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site">
      <div className="header-inner">
        <Link className="logo" href="/" style={{ cursor: "pointer" }} onClick={closeMenu}>
          <span className="mark"></span>Recruitable
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav className={`site-nav${menuOpen ? " open" : ""}`}>
          <Link href="/" className={isLanding ? "active" : ""} onClick={closeMenu}>Hem</Link>
          <Link href="/rekrytera" className={isRekrytera ? "active" : ""} onClick={closeMenu}>Rekrytera</Link>
          <Link href="/bolag" className={isBolag ? "active" : ""} onClick={closeMenu}>Bolag</Link>
          <Link href="/om-oss" className={isOmOss ? "active" : ""} onClick={closeMenu}>Om oss</Link>
          <Link href="/logga-in" className={isLoggaIn ? "active" : ""} onClick={closeMenu}>Logga in</Link>
        </nav>
      </div>
    </header>
  );
}
