"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LoggaUtKnapp from "@/components/admin/LoggaUtKnapp";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inloggad, setInloggad] = useState(false);
  // Ett inloggat bolag har ingen nytta av att söka leverantör åt sig självt.
  // Läses ur den lokala sessionens metadata, som stämplas vid godkännandet —
  // annars hade varje sidvisning behövt en databasfråga för att avgöra det.
  // Styr bara vad som visas; åtkomsten avgörs alltid på servern.
  const [arBolagsadmin, setArBolagsadmin] = useState(false);
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
      if (!aktiv) return;
      setInloggad(Boolean(data.session));
      setArBolagsadmin(Boolean(data.session?.user?.user_metadata?.bolagsadmin));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_handelse, session) => {
      setInloggad(Boolean(session));
      setArBolagsadmin(Boolean(session?.user?.user_metadata?.bolagsadmin));
    });

    return () => {
      aktiv = false;
      subscription.unsubscribe();
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site">
      <div className="header-inner">
        {/* Logotypen leder hem, och hemma för ett inloggat bolag är Mina sidor —
            inte startsidan, som säljer in registret till den som söker
            leverantör. */}
        <Link
          className="logo"
          href={arBolagsadmin ? "/mina-sidor" : "/"}
          style={{ cursor: "pointer" }}
          onClick={closeMenu}
        >
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
          {/* Startsidan och Rekrytera vänder sig till den som söker leverantör.
              För ett inloggat bolag är de bara förvirrande — de erbjuder att göra
              det bolaget självt finns i registret för. */}
          {!arBolagsadmin && (
            <>
              <Link href="/" className={isLanding ? "active" : ""} onClick={closeMenu}>Hem</Link>
              <Link href="/rekrytera" className={isRekrytera ? "active" : ""} onClick={closeMenu}>Rekrytera</Link>
            </>
          )}
          <Link href="/om-oss" className={isOmOss ? "active" : ""} onClick={closeMenu}>Om oss</Link>
          {inloggad ? (
            <>
              <Link href="/mina-sidor" className={isMinaSidor ? "active" : ""} onClick={closeMenu}>Mina sidor</Link>
              <LoggaUtKnapp className="nav-utloggning" vidKlick={closeMenu} />
            </>
          ) : (
            <Link href="/logga-in" className={isLoggaIn ? "active" : ""} onClick={closeMenu}>Logga in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
