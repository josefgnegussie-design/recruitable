"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inloggad, setInloggad] = useState(false);
  const isLanding = pathname === "/";
  const isRekrytera = pathname.startsWith("/rekrytera");
  const isOmOss = pathname.startsWith("/om-oss");
  const isLoggaIn = pathname.startsWith("/logga-in");
  // /admin räknas hit: dit skickas ett plattformsadminkonto vidare från
  // /mina-sidor, så det är samma länk sett från besökaren.
  const isMinaSidor = pathname.startsWith("/mina-sidor") || pathname.startsWith("/admin");

  // Headern sa "Logga in" även för den som redan var inloggad, och var dessutom
  // enda vägen härifrån till det inloggade läget — man klickade och hamnade på
  // inloggningssidan trots att sessionen var hel.
  //
  // getSession() läser kakan lokalt utan att fråga Supabase, så det kostar
  // ingen rundtur. Utgångsläget är utloggat, vilket stämmer för i stort sett
  // varje besökare; den som är inloggad ser texten byta direkt efter första
  // renderingen. onAuthStateChange gör att länken följer med vid ut- och
  // inloggning utan att sidan behöver laddas om.
  useEffect(() => {
    const supabase = createClient();
    let aktiv = true;

    supabase.auth.getSession().then(({ data }) => {
      if (aktiv) setInloggad(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_handelse, session) => {
      setInloggad(Boolean(session));
    });

    return () => {
      aktiv = false;
      subscription.unsubscribe();
    };
  }, []);

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
          <Link href="/om-oss" className={isOmOss ? "active" : ""} onClick={closeMenu}>Om oss</Link>
          {inloggad ? (
            <Link href="/mina-sidor" className={isMinaSidor ? "active" : ""} onClick={closeMenu}>Mina sidor</Link>
          ) : (
            <Link href="/logga-in" className={isLoggaIn ? "active" : ""} onClick={closeMenu}>Logga in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
