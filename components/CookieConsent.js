"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!getConsent());
  }, []);

  function handle(choice) {
    setConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie-inställningar">
      <p className="cookie-banner-text">
        Vi använder cookies för att mäta hur besökare använder recruitable.se och därigenom förbättra tjänsten.
        Icke-nödvändiga cookies sätts bara om du godkänner det. Läs mer i vår{" "}
        <Link href="/integritetspolicy">integritetspolicy</Link>.
      </p>
      <div className="cookie-banner-actions">
        <button className="cookie-btn ghost" onClick={() => handle("declined")}>Endast nödvändiga</button>
        <button className="cookie-btn primary" onClick={() => handle("accepted")}>Acceptera alla</button>
      </div>
    </div>
  );
}
