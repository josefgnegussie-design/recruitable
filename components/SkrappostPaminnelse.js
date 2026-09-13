"use client";

import { useEffect, useRef, useState } from "react";

// Påminnelse om skräpposten, direkt efter att ett bekräftelsemejl skickats.
//
// Anledningen är inte teoretisk: mejlen autentiserar rätt — SPF, DKIM och en
// DMARC-policy på reject — och hamnar ändå i skräpposten hos Microsoft-kunder,
// eftersom avsändardomänen är ny och mottagaren aldrig växlat post med den
// förut. Det är inget vi kan konfigurera bort. Det vi kan göra är att säga till
// i samma ögonblick som mejlet skickas, medan personen fortfarande sitter kvar
// och letar efter det.
//
// Rutan öppnas av sig själv, för den som redan fått mejlet i inkorgen klickar
// bort den på en sekund — medan den som inte fått det annars hade dragit
// slutsatsen att ingenting skickades.
export default function SkrappostPaminnelse({ adress }) {
  const [open, setOpen] = useState(true);
  const knappRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Fokus i rutan, så att Enter och Escape går dit blicken är.
    knappRef.current?.focus();

    function vidTangent(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", vidTangent);
    return () => document.removeEventListener("keydown", vidTangent);
  }, [open]);

  if (!open) return null;

  return (
    <div className="confirm-overlay" onClick={() => setOpen(false)}>
      <div
        className="confirm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skrappost-rubrik"
      >
        <h3 id="skrappost-rubrik">Håll utkik i skräpposten</h3>
        <p className="sub">
          Bekräftelsen är skickad{adress ? <> till <b>{adress}</b></> : null}. Håll utkik i skräpposten
          ifall den inte kommit fram till inkorgen — mejlet kommer från <b>recruitable.se</b>.
        </p>
        <p className="note" style={{ fontSize: 12.5, marginTop: -4 }}>
          Hittar du det där: markera det som &quot;inte skräppost&quot;, så hamnar kommande mejl från oss
          rätt direkt.
        </p>
        <div className="confirm-actions">
          <button type="button" className="qs-btn" ref={knappRef} onClick={() => setOpen(false)}>
            Okej
          </button>
        </div>
      </div>
    </div>
  );
}
