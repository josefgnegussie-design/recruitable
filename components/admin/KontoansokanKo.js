"use client";

import { useState } from "react";

// Granskningskön för kontoansökningar. Matchar ansökans org.nummer mot registret
// så att det vanliga fallet blir ett klick — bolaget finns oftast redan bland de
// importerade. Saknas det går det att söka fram, eller skapa bolaget ur ansökan.
export default function KontoansokanKo({ ansokningar }) {
  const [kvar, setKvar] = useState(ansokningar);
  const [arbetar, setArbetar] = useState(null);
  const [fel, setFel] = useState("");

  // Manuellt valt bolag per ansökan, för när matchningen på organisationsnummer
  // inte gav något. Tusentals importerade bolag saknar numret, och utan den här
  // vägen skapar ett godkännande ett dubblettbolag bredvid den profil som redan
  // finns — med vision, beskrivning och orter — som då blir kvar oövertagen.
  const [valt, setValt] = useState({});
  const [traffar, setTraffar] = useState({});
  const [soker, setSoker] = useState(null);

  async function sok(ansokanId, fraga) {
    if (fraga.trim().length < 2) {
      setTraffar((t) => ({ ...t, [ansokanId]: null }));
      return;
    }
    setSoker(ansokanId);
    try {
      const res = await fetch(`/api/admin/bolag-sok?q=${encodeURIComponent(fraga)}`);
      const body = await res.json();
      setTraffar((t) => ({ ...t, [ansokanId]: res.ok ? body.traffar || [] : [] }));
    } catch {
      setTraffar((t) => ({ ...t, [ansokanId]: [] }));
    } finally {
      setSoker(null);
    }
  }

  async function besluta(ansokan, beslut, companyId) {
    setArbetar(ansokan.id);
    setFel("");

    const res = await fetch("/api/admin/kontoansokan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ansokanId: ansokan.id, beslut, companyId: companyId ?? null }),
    });

    setArbetar(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFel(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setKvar((prev) => prev.filter((a) => a.id !== ansokan.id));
  }

  if (!kvar.length) {
    return <div className="auth-panel"><p style={{ margin: 0 }}>Inga ansökningar väntar på granskning.</p></div>;
  }

  return (
    <div>
      {fel && <p style={{ color: "#c0392b", fontSize: 13 }}>{fel}</p>}

      {kvar.map((a) => (
        <div className="auth-panel" key={a.id} style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{a.claimed_company_name}</h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 14px" }}>
            {a.claimed_org_number} · {a.claimed_address}
          </p>

          <div className="side-fact"><span className="k">Webbplats</span><span className="v">{a.claimed_website}</span></div>
          <div className="side-fact"><span className="k">Yrkesområden</span><span className="v">{a.claimed_focus_areas?.join(", ") || "—"}</span></div>
          <div className="side-fact"><span className="k">Tjänster</span><span className="v">{a.claimed_services?.join(", ") || "—"}</span></div>

          <div style={{ marginTop: 16 }}>
            {(() => {
              const bolag = valt[a.id] ?? a.foreslaget;
              return (
                <>
                  {bolag ? (
                    <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
                      {valt[a.id] ? "Valt bolag: " : "Matchar "}
                      <strong>{bolag.name}</strong> ({bolag.city}, id {bolag.id})
                      {valt[a.id] ? "" : " på organisationsnummer"}.
                      {valt[a.id] && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setValt((v) => ({ ...v, [a.id]: undefined }))}
                          >
                            Ångra valet
                          </button>
                        </>
                      )}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13.5, margin: "0 0 12px", color: "var(--color-muted)" }}>
                      Inget bolag i registret har det här organisationsnumret. Godkänner du utan att
                      välja nedan skapas bolaget ur ansökans uppgifter.
                    </p>
                  )}

                  {/* Sökningen står kvar även när org.numret matchat — matchningen
                      kan peka på fel rad, och då ska den gå att styra om. */}
                  <details className="koppla-sok" open={!bolag}>
                    <summary>Bolaget finns redan — sök och koppla dit</summary>
                    <input
                      type="text"
                      placeholder="Namn eller organisationsnummer"
                      onChange={(e) => sok(a.id, e.target.value)}
                      aria-label="Sök bolag i registret"
                    />
                    {soker === a.id && <p className="note">Söker…</p>}
                    {traffar[a.id]?.length === 0 && soker !== a.id && (
                      <p className="note">Inga träffar i registret.</p>
                    )}
                    {traffar[a.id]?.length > 0 && (
                      <ul className="koppla-traffar">
                        {traffar[a.id].map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => setValt((v) => ({ ...v, [a.id]: b }))}
                            >
                              <span className="lookup-name">{b.name}</span>
                              <span className="lookup-meta">
                                {[b.city, b.org_number || "utan org.nummer", `id ${b.id}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {b.claimed ? " · redan övertaget" : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </>
              );
            })()}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
              <button
                className="qs-btn"
                style={{ width: "auto", padding: "11px 20px" }}
                disabled={arbetar === a.id}
                onClick={() => besluta(a, "godkann", (valt[a.id] ?? a.foreslaget)?.id)}
              >
                {arbetar === a.id
                  ? "Arbetar..."
                  : (valt[a.id] ?? a.foreslaget)
                    ? `Godkänn och koppla till ${(valt[a.id] ?? a.foreslaget).name}`
                    : "Godkänn och skapa bolaget"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: "none", padding: "11px 20px" }}
                disabled={arbetar === a.id}
                onClick={() => besluta(a, "avsla")}
              >
                Avslå
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
