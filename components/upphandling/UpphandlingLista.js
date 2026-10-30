"use client";

import { useMemo, useState } from "react";
import UpphandlingKort from "@/components/upphandling/UpphandlingKort";

export default function UpphandlingLista({ lista, otillganglig }) {
  const [tjanst, setTjanst] = useState("Alla");

  // Bara tjänster som faktiskt finns i listan, så att inget filter leder till
  // en tom sida.
  const tjanster = useMemo(() => ["Alla", ...new Set(lista.map((u) => u.service))], [lista]);
  const synliga = tjanst === "Alla" ? lista : lista.filter((u) => u.service === tjanst);

  return (
    <section id="oppna" aria-labelledby="oppna-rubrik">
      <div className="results-bar">
        <h2 id="oppna-rubrik" className="upp-rubrik">
          Öppna upphandlingar <span className="results-count">{synliga.length} st</span>
        </h2>
        {tjanster.length > 2 && (
          <div className="upp-chips">
            {tjanster.map((t) => (
              <button type="button" key={t} className={`chip${t === tjanst ? " on" : ""}`} aria-pressed={t === tjanst} onClick={() => setTjanst(t)}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {otillganglig ? (
        <p>Upphandlingarna går inte att visa just nu. Försök igen om en stund.</p>
      ) : synliga.length === 0 ? (
        <p>Det finns inga öppna upphandlingar just nu.</p>
      ) : (
        <div className="grid">
          {synliga.map((u) => (
            <UpphandlingKort u={u} key={u.id} href={`/upphandling/${u.id}`} />
          ))}
        </div>
      )}
    </section>
  );
}
