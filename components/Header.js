"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const isLanding = pathname === "/";
  const isRekrytera = pathname.startsWith("/rekrytera");
  const isBolag = pathname.startsWith("/bolag");
  const isOmOss = pathname.startsWith("/om-oss");
  const isLoggaIn = pathname.startsWith("/logga-in");
  const isMinaSidor = pathname.startsWith("/mina-sidor");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  if (pathname === "/coming-soon") return null;

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    closeMenu();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
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
          <Link href="/bolag" className={isBolag ? "active" : ""} onClick={closeMenu}>Hitta bolag</Link>
          <Link href="/om-oss" className={isOmOss ? "active" : ""} onClick={closeMenu}>Om oss</Link>
          {loggedIn ? (
            <>
              <Link href="/mina-sidor" className={isMinaSidor ? "active" : ""} onClick={closeMenu}>Mina sidor</Link>
              <button type="button" className="nav-link-btn" onClick={handleLogout}>Logga ut</button>
            </>
          ) : (
            <Link href="/logga-in" className={isLoggaIn ? "active" : ""} onClick={closeMenu}>Logga in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
