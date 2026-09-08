"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Vår egen sidvisningsmätning. Skiljer sig från GoogleAnalytics.js på två
// sätt som är hela poängen: den lagrar ingenting i besökarens webbläsare, och
// den räknar därför alla besökare — inte bara dem som klickat "Godkänn" i
// cookie-bannern. Siffrorna hamnar i vår egen databas och syns i /admin.
export default function Sidvisningar() {
  const pathname = usePathname();
  const senaste = useRef(null);

  useEffect(() => {
    if (!pathname) return;
    // Vårt eget interna arbete är inte trafik på sajten.
    if (pathname.startsWith("/admin")) return;
    // React kör effekter två gånger i utvecklingsläge, och en tillbakanavigering
    // till samma sida ska inte heller räknas två gånger.
    if (senaste.current === pathname) return;
    senaste.current = pathname;

    const kropp = JSON.stringify({ path: pathname });

    // sendBeacon skickas färdigt även om besökaren klickar vidare direkt —
    // annars tappas just de snabba besöken, som är de vanligaste.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/statistik/handelse", new Blob([kropp], { type: "application/json" }));
      return;
    }

    fetch("/api/statistik/handelse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: kropp,
      keepalive: true,
    }).catch(() => {
      // Mätningen får aldrig störa besöket.
    });
  }, [pathname]);

  return null;
}
