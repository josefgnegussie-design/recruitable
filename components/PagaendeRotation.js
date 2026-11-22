"use client";

import { useEffect, useRef, useState } from "react";

// Hur många kort som syns samtidigt, och hur ofta ett av dem byts ut.
const VISADE = 3;
const INTERVALL = 5000;
// Måste stämma med animationen .upp-pagaende-kort.lamnar i globals.css.
const UT_MS = 350;

// Korten i bandet för pågående förfrågningar och upphandlingar. Finns fler än
// tre byts ett kort i taget ut mot nästa i listan, med en mjuk övergång, så att
// bandet visar fler av de senaste utan att allt flyttar sig på en gång.
//
// Rotationen pausar när muspekaren är över bandet eller något i det har fokus,
// när fliken inte syns, och står helt still för den som valt reducerad rörelse
// i sitt system. Servern renderar de tre första, så sidan ser likadan ut innan
// skriptet laddats.
export default function PagaendeRotation({ kort, stegEtikett }) {
  const n = kort.length;
  const [platser, setPlatser] = useState(() => kort.slice(0, VISADE).map((_, i) => ({ i, fas: "" })));
  const pausad = useRef(false);
  const nasta = useRef(VISADE);
  const tick = useRef(0);

  useEffect(() => {
    if (n <= VISADE) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timers = new Set();
    const vanta = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    const id = setInterval(() => {
      if (pausad.current || document.hidden) return;
      const plats = tick.current++ % VISADE;
      const ny = nasta.current++ % n;
      setPlatser((p) => p.map((s, k) => (k === plats ? { ...s, fas: "lamnar" } : s)));
      vanta(() => {
        setPlatser((p) => p.map((s, k) => (k === plats ? { i: ny, fas: "kommer" } : s)));
      }, UT_MS);
    }, INTERVALL);

    return () => {
      clearInterval(id);
      for (const t of timers) clearTimeout(t);
    };
  }, [n]);

  return (
    <ul
      className="upp-pagaende-lista"
      onMouseEnter={() => {
        pausad.current = true;
      }}
      onMouseLeave={() => {
        pausad.current = false;
      }}
      onFocus={() => {
        pausad.current = true;
      }}
      onBlur={() => {
        pausad.current = false;
      }}
    >
      {platser.map(({ i, fas }, plats) => {
        const u = kort[i];
        return (
          <li key={`${plats}-${i}`} className={`auth-panel upp-pagaende-kort${fas ? ` ${fas}` : ""}`}>
            {u.exempel && <span className="tag upp-exempel-tagg">Exempel</span>}
            {u.orter && <p className="upp-pagaende-ort">{u.orter}</p>}
            <h3>{u.rubrik}</h3>
            <p className="upp-pagaende-text">{u.mening}</p>
            <ol className="upp-tidslinje" aria-label={stegEtikett} style={{ "--steg": u.tidslinje.length }}>
              {u.tidslinje.map((t) => (
                <li key={t.steg}>
                  <span className={t.datum ? "punkt" : "punkt tom"} aria-hidden="true" />
                  <span className={t.framhavd ? "steg framhavd" : "steg"}>{t.steg}</span>
                  <span className="datum">{t.datum ?? "–"}</span>
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}
