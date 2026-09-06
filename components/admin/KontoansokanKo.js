"use client";

import { useState } from "react";

// Granskningskön för kontoansökningar. Matchar ansökans org.nummer mot registret
// så att det vanliga fallet blir ett klick — bolaget finns oftast redan bland de
// importerade. Saknas det går det att söka fram, eller skapa bolaget ur ansökan.
export default function KontoansokanKo({ ansokningar }) {
  const [kvar, setKvar] = useState(ansokningar);
  const [arbetar, setArbetar] = useState(null);
  const [fel, setFel] = useState("");

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
            {a.foreslaget ? (
              <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
                Matchar <strong>{a.foreslaget.name}</strong> i registret ({a.foreslaget.city}, id{" "}
                {a.foreslaget.id}) på organisationsnummer.
              </p>
            ) : (
              <p style={{ fontSize: 13.5, margin: "0 0 12px", color: "var(--color-muted)" }}>
                Inget bolag i registret har det här organisationsnumret. Godkänner du skapas bolaget
                ur ansökans uppgifter.
              </p>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="qs-btn"
                style={{ width: "auto", padding: "11px 20px" }}
                disabled={arbetar === a.id}
                onClick={() => besluta(a, "godkann", a.foreslaget?.id)}
              >
                {arbetar === a.id
                  ? "Arbetar..."
                  : a.foreslaget
                    ? `Godkänn och koppla till ${a.foreslaget.name}`
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
