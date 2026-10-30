"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LoggaUtKnapp from "@/components/admin/LoggaUtKnapp";

// Flikarna var tidigare ett useState, så omladdning och bakåtknappen tog alltid
// tillbaka till Förfrågningar och det gick inte att länka till en flik. Nu är
// varje flik en egen sida, och raden här är bara länkar. Sidan som är öppen
// avgörs av adressen.
const FLIKAR = [
  { href: "/mina-sidor", namn: "Förfrågningar" },
  { href: "/mina-sidor/profil", namn: "Profil" },
  { href: "/mina-sidor/kontor", namn: "Kontor" },
  { href: "/mina-sidor/konto", namn: "Konto" },
];

function arAktiv(pathname, href) {
  // En enskild förfrågan (/mina-sidor/forfragningar/<id>) hör till första fliken.
  if (href === "/mina-sidor") return pathname === href || pathname.startsWith("/mina-sidor/forfragningar");
  return pathname === href || pathname.startsWith(href + "/");
}

// Låter förfrågningslistan ändra räknaren på fliken när bolaget svarar, utan
// omladdning. Listan ligger i sidan och räknaren här, så de når varandra
// genom kontexten och inte genom props.
const ObesvaradeKontext = createContext(null);

export function useAndraObesvarade() {
  return useContext(ObesvaradeKontext);
}

const BESKED = {
  premium: {
    klart: { ok: true, text: "Tack! Betalningen är mottagen och premium aktiveras inom kort." },
    avbrutet: { ok: false, text: "Uppgraderingen avbröts — inget drogs från kortet." },
  },
  kontor: {
    klart: { ok: true, text: "Tack! Betalningen är mottagen och kontoret aktiveras inom kort." },
    avbrutet: { ok: false, text: "Tillägget av kontoret avbröts — inget drogs från kortet." },
  },
};

export default function MinaSidorTabs({ obesvarade: initialtObesvarade, antalKontor, premiumStatus, officeStatus, children }) {
  const pathname = usePathname();
  // Räknas i databasen och kommer med varje sida, så den stämmer vid varje
  // flikbyte. Lokalt minskas den bara när bolaget svarar på den här sidan.
  const [obesvarade, setObesvarade] = useState(initialtObesvarade);
  const besked = [BESKED.premium[premiumStatus], BESKED.kontor[officeStatus]].filter(Boolean);

  function andraObesvarade(diff) {
    setObesvarade((n) => Math.max(0, n + diff));
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      {besked.map((b) => (
        <p
          key={b.text}
          style={{
            background: b.ok ? "#eaf5ee" : "#fbeceb",
            color: b.ok ? "#1c6b3a" : "#c0392b",
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {b.text}
        </p>
      ))}
      <nav className="tab-row" aria-label="Mina sidor">
        {FLIKAR.map((f) => {
          const aktiv = arAktiv(pathname, f.href);
          let namn = f.namn;
          // Fliken räknar bara det som väntar på svar. Alla förfrågningar,
          // besvarade inräknade, säger inget om vad som behöver göras.
          if (f.href === "/mina-sidor" && obesvarade > 0) {
            namn += ` · ${obesvarade} ${obesvarade === 1 ? "ny" : "nya"}`;
          }
          if (f.href === "/mina-sidor/kontor" && antalKontor > 0) namn += ` (${antalKontor})`;
          return (
            <Link
              key={f.href}
              href={f.href}
              className={`tab-btn${aktiv ? " active" : ""}`}
              aria-current={aktiv ? "page" : undefined}
            >
              {namn}
            </Link>
          );
        })}
        <LoggaUtKnapp />
      </nav>

      <ObesvaradeKontext.Provider value={andraObesvarade}>{children}</ObesvaradeKontext.Provider>
    </div>
  );
}
