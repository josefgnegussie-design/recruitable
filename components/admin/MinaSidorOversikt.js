"use client";

import Link from "next/link";
import { useObesvarade } from "@/components/admin/MinaSidorTabs";

function tal(n) {
  return n.toLocaleString("sv-SE");
}

// En rad överst på förfrågningsfliken: vad som väntar på svar, hur komplett
// profilen är och hur många som sett den. Profildelarna leder dit man gör något
// åt dem. Obesvarade läses ur flikradens räknare, så siffran minskar här i
// samma ögonblick som bolaget svarar.
export default function MinaSidorOversikt({ profil, profilvisningar, profiladress }) {
  const obesvarade = useObesvarade();

  return (
    <div className="mina-sidor-oversikt" role="region" aria-label="Översikt">
      {/* Förfrågningarna står direkt under, så den här delen är ingen länk. */}
      <span className="oversikt-del">
        <b>{tal(obesvarade)}</b> {obesvarade === 1 ? "obesvarad förfrågan" : "obesvarade förfrågningar"}
      </span>
      {profil && (
        <Link
          href="/mina-sidor/profil"
          className="oversikt-del"
          title={profil.saknas.length ? `Saknas: ${profil.saknas.join(", ")}` : undefined}
        >
          Profilen <b>{profil.ifyllda} av {profil.totalt}</b> ifylld
          {profil.saknas.length > 0 && <span className="oversikt-atgard">Komplettera</span>}
        </Link>
      )}
      {profilvisningar !== null && profiladress && (
        <Link href={profiladress} className="oversikt-del">
          <b>{tal(profilvisningar)}</b> profilvisningar senaste 30 dagarna
        </Link>
      )}
    </div>
  );
}
