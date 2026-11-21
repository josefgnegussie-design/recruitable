"use client";

import { useEffect, useState } from "react";
import { VARNA_VID_BOLAG } from "@/lib/upphandlingInbjudan";

// Hur många bolag som syns innan "Visa fler": lika många som är förvalda, så att
// köparen ser exakt vilka som får inbjudan. Resten finns ett klick bort.
const FORST = 10;

function avstandText(t) {
  if (t.niva === "ort") return t.ort;
  return `${t.ort} (${t.km < 10 ? `${t.km} km` : `${Math.round(t.km / 10)} mil`})`;
}

// Bolagen i registret som passar det köparen fyllt i hittills, med en kryssruta
// var. De valda får inbjudan. Uppdateras medan formuläret fylls i, med en kort
// fördröjning så att varje tangent inte blir en fråga. Visar bara det som redan
// står på de publika profilerna.
export default function RelevantaBolag({ tjanst, omraden, orter, krav, vidResultat, valda, vaxla, valjAlla, valjInga }) {
  const [svar, setSvar] = useState(null);
  const [laddar, setLaddar] = useState(false);
  const [allaSynliga, setAllaSynliga] = useState(false);
  const nyckel = JSON.stringify({ tjanst, omraden, orter, krav });
  // Utan yrkesområde och ort finns inget att matcha på. Ett gammalt svar får då
  // inte stå kvar, så det döljs här i stället för att nollställas i effekten.
  const komplett = omraden.length > 0 && orter.length > 0;

  useEffect(() => {
    if (!komplett) return;
    const avbryt = new AbortController();
    const t = setTimeout(async () => {
      setLaddar(true);
      try {
        const res = await fetch("/api/upphandling/matcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: nyckel,
          signal: avbryt.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSvar(data);
          vidResultat?.(data);
        }
      } catch {
        // Avbruten av en nyare ändring, eller nätet borta. Förra svaret står kvar.
      } finally {
        if (!avbryt.signal.aborted) setLaddar(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      avbryt.abort();
    };
  }, [nyckel, komplett, vidResultat]);

  if (!komplett || !svar) {
    return (
      <section className="auth-panel upp-match">
        <h2 className="upp-rubrik-liten">3. Välj bolag att bjuda in</h2>
        <p className="upp-brod">
          Välj minst ett yrkesområde och en ort ovan, så visar vi direkt vilka bemannings- och rekryteringsbolag i
          registret som kan leverera.
        </p>
      </section>
    );
  }

  const synliga = allaSynliga ? svar.bolag : svar.bolag.slice(0, FORST);

  return (
    <section className={`auth-panel upp-match${laddar ? " laddar" : ""}`} aria-live="polite" aria-busy={laddar}>
      <div className="upp-match-huvud">
        <h2 className="upp-rubrik-liten">3. Välj bolag att bjuda in</h2>
        {svar.totalt > 0 && (
          <span className="upp-not">
            {svar.totalt} relevanta bolag,{" "}
            {svar.aktiva === 0
              ? "inget av dem aktivt på Recruitable än"
              : `${svar.aktiva} ${svar.aktiva === 1 ? "aktivt" : "aktiva"} på Recruitable`}
          </span>
        )}
      </div>

      {svar.perOrt.length > 0 && (
        <ul className="upp-ortstapel">
          {svar.perOrt.map((o) => (
            <li key={o.ort} className={o.paOrten + o.nara === 0 ? "lucka" : ""}>
              <span className="ort">{o.ort}</span>
              <span className="tal">
                {o.paOrten + o.nara === 0
                  ? "Inga bolag i närheten"
                  : `${o.paOrten} på orten${o.nara ? `, ${o.nara} i närheten` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {svar.totalt === 0 ? (
        <p className="upp-brod">
          Inga bolag i registret matchar. Prova fler yrkesområden, en annan tjänst eller en större ort i närheten.
        </p>
      ) : (
        <>
          <p className="upp-not" style={{ marginTop: 0 }}>
            Sorterade efter hur många av era orter bolaget finns på, därefter yrkesområden och krav som går att läsa i
            profilen. De {Math.min(FORST, svar.bolag.length)} översta är förvalda.
          </p>
          <div className="upp-valrad">
            <strong>
              {valda.size} av {svar.bolag.length} valda
            </strong>
            <span className="upp-rad-tat">
              <button type="button" className="link-btn" onClick={valjAlla}>Välj alla</button>
              <button type="button" className="link-btn" onClick={valjInga}>Avmarkera alla</button>
            </span>
          </div>
          {valda.size > VARNA_VID_BOLAG && (
            <p className="upp-varning">
              Ni har valt {valda.size} bolag. Det blir ofta fler samtal att hantera än svar att välja bland.
            </p>
          )}
          <ol className="upp-matchlista">
            {synliga.map((b) => (
              <li key={b.id} className={valda.has(b.id) ? "vald" : ""}>
                <div className="upp-match-rad">
                  <label className="upp-match-namn">
                    <input type="checkbox" checked={valda.has(b.id)} onChange={() => vaxla(b.id)} aria-label={`Bjud in ${b.namn}`} />
                    {b.logo && (
                      // En extern logga som inte längre finns ska inte lämna en trasig bild.
                      <img src={b.logo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
                    )}
                    <div>
                      <span className="namn">{b.namn}</span>
                      <div className="upp-match-ort">
                        {b.ort}
                        {b.medarbetare ? ` · ${b.medarbetare} medarbetare` : ""} ·{" "}
                        <a href={b.profil} target="_blank" rel="noopener noreferrer">Profil ↗</a>
                      </div>
                    </div>
                  </label>
                  <span className={`upp-status ${b.aktiv ? "aktiv" : ""}`}>
                    {b.aktiv ? "Aktiv på Recruitable" : "Inte aktiv än"}
                  </span>
                </div>
                <dl className="upp-fakta">
                  <dt>Täcker</dt>
                  <dd>{b.tackning.map(avstandText).join(", ")}</dd>
                  <dt>Områden</dt>
                  <dd>{b.omraden.join(", ")}</dd>
                  {b.krav.length > 0 && (
                    <>
                      <dt>Enligt profilen</dt>
                      <dd>{b.krav.join(", ")}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ol>
          {svar.bolag.length > FORST && (
            <button type="button" className="link-btn" onClick={() => setAllaSynliga((v) => !v)}>
              {allaSynliga ? "Visa färre" : `Visa ${svar.bolag.length - FORST} till`}
            </button>
          )}
          {svar.totalt > svar.bolag.length && (
            <p className="upp-not">Visar de {svar.bolag.length} mest relevanta av {svar.totalt}.</p>
          )}
        </>
      )}
    </section>
  );
}
