"use client";

import { useEffect, useState } from "react";
import { UPPSAGNINGSSKAL } from "@/lib/uppsagning";

// Prenumerationen hanteras i Stripes egen portal — vi bygger inget eget
// gränssnitt för kort, kvitton och uppsägning.
//
// Det enda som ligger före portalen är ett steg vid uppsägning: vad bolaget
// faktiskt fått ut den senaste tiden, och en fråga om varför de slutar. Steget
// hindrar ingenting och går att klicka förbi på två sekunder. En uppsägning som
// görs svår blir inte en utebliven uppsägning, den blir en invändning hos banken
// och ett bolag som varnar andra — och registret lever på att bolagen litar på
// det.
export default function PremiumManageButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visarUppsagning, setVisarUppsagning] = useState(false);
  const [skal, setSkal] = useState("");
  const [utfall, setUtfall] = useState(null);

  // Siffrorna hämtas när rutan öppnas och inte vid sidladdning: de angår bara
  // den som faktiskt är på väg att säga upp.
  useEffect(() => {
    if (!visarUppsagning) return;
    let levande = true;
    fetch("/api/mina-sidor/uppsagning")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => levande && setUtfall(d?.utfall || null))
      .catch(() => {});
    return () => {
      levande = false;
    };
  }, [visarUppsagning]);

  async function oppnaPortal() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setLoading(false);
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }
    window.location.href = body.url;
  }

  async function fortsattTillUppsagning() {
    setLoading(true);
    setError("");
    // Skälet sparas först, men ett fel här får inte stoppa uppsägningen — den
    // är deras rätt, svaret är vår nyfikenhet.
    try {
      await fetch("/api/mina-sidor/uppsagning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: skal }),
      });
    } catch {
      /* vidare ändå */
    }
    await oppnaPortal();
  }

  return (
    <div style={{ marginBottom: 20, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="link-btn" onClick={oppnaPortal} disabled={loading}>
        {loading && !visarUppsagning ? "Öppnar..." : "Hantera prenumeration"}
      </button>
      <button
        type="button"
        className="link-btn"
        onClick={() => setVisarUppsagning(true)}
        disabled={loading}
        style={{ color: "var(--color-muted)" }}
      >
        Säg upp prenumerationen
      </button>
      {error && <p style={{ color: "#c0392b", fontSize: 13, margin: 0 }}>{error}</p>}

      {visarUppsagning && (
        <div className="confirm-overlay" onClick={() => !loading && setVisarUppsagning(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Säga upp prenumerationen</h3>

            {utfall && utfall.forfragningar > 0 ? (
              <p className="sub">
                De senaste {utfall.dagar} dagarna har ni fått{" "}
                <b>
                  {utfall.forfragningar} förfråg{utfall.forfragningar === 1 ? "an" : "ningar"}
                </b>
                {utfall.accepterade > 0 && <>, varav ni accepterat {utfall.accepterade}</>}. Prenumerationen
                löper till periodens slut — profilen ligger kvar i registret även efter det.
              </p>
            ) : (
              <p className="sub">
                Prenumerationen löper till periodens slut, och profilen ligger kvar i registret även efter
                det. Ni blir inte borttagna ur registret av att säga upp.
              </p>
            )}

            <div className="field">
              <label htmlFor="uppsagning-skal">Varför säger ni upp?</label>
              <select
                id="uppsagning-skal"
                value={skal}
                onChange={(e) => setSkal(e.target.value)}
                disabled={loading}
              >
                <option value="">Välj ett skäl</option>
                {UPPSAGNINGSSKAL.map((s) => (
                  <option key={s.varde} value={s.varde}>
                    {s.etikett}
                  </option>
                ))}
              </select>
              <p className="hint">
                Svaret går till oss och påverkar ingenting i uppsägningen. Det är så vi får veta vad vi ska
                laga.
              </p>
            </div>

            {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}

            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setVisarUppsagning(false)}
                disabled={loading}
              >
                Avbryt
              </button>
              <button
                type="button"
                className="qs-btn"
                onClick={fortsattTillUppsagning}
                disabled={loading || !skal}
              >
                {loading ? "Öppnar..." : "Fortsätt till uppsägningen"}
              </button>
            </div>

            <p className="note" style={{ marginTop: 14, fontSize: 12.5 }}>
              Passar inte upplägget? Hör av er till{" "}
              <a href="mailto:info@recruitable.se">info@recruitable.se</a> så ser vi vad vi kan göra.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
