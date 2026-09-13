"use client";

import { useState } from "react";

function datum(iso) {
  return iso ? new Date(iso).toLocaleDateString("sv-SE") : null;
}

// Granskningskön för begärda sammanslagningar.
//
// Beslutet är det mest ingripande som fattas i registret: ett bolag slutar
// synas. Kön är därför byggd som en genomgång och inte som en godkännandeknapp
// — hindren stoppar, signalerna visas, och bekräftelsen räknar upp exakt vad
// som händer innan något sker.
export default function SammanslagningsKo({ arenden }) {
  const [kvar, setKvar] = useState(arenden);
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState("");
  const [bekraftar, setBekraftar] = useState(null);
  const [not, setNot] = useState("");
  const [klart, setKlart] = useState(null);

  function oppna(arende, beslut) {
    setBekraftar({ arende, beslut });
    setNot("");
    setFel("");
  }

  async function besluta() {
    const { arende, beslut } = bekraftar;
    setArbetar(true);
    setFel("");

    const res = await fetch("/api/admin/sammanslagning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arendeId: arende.id, beslut, not: not.trim() || null }),
    });

    const body = await res.json().catch(() => ({}));
    setArbetar(false);

    if (!res.ok) {
      setFel(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setBekraftar(null);
    setKvar((prev) => prev.filter((a) => a.id !== arende.id));

    if (beslut === "godkann") {
      setKlart({
        namn: `${arende.upphorande?.name} → ${arende.overlevande?.name}`,
        arvdaOrter: body.arvdaOrter ?? [],
        flyttadeKontor: body.flyttadeKontor ?? 0,
        flyttadeAdmins: body.flyttadeAdmins ?? 0,
        anmarkningar: body.anmarkningar ?? [],
      });
    } else {
      setKlart({ namn: `${arende.upphorande?.name} → ${arende.overlevande?.name}`, nekad: true });
    }
  }

  return (
    <div>
      {klart && (
        <div className="admin-panel" style={{ borderColor: "var(--color-success, #3f8f5f)" }}>
          {klart.nekad ? (
            <p style={{ margin: 0 }}>
              <strong>{klart.namn}</strong> — nekad. Båda bolagen ligger kvar som de var, och båda
              bolagens administratörer har fått beskedet.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 8px" }}>
                <strong>{klart.namn}</strong> — sammanslaget.
              </p>
              <ul className="confirm-company-list">
                <li>
                  {klart.arvdaOrter.length
                    ? `Orter som flyttades med: ${klart.arvdaOrter.join(", ")}`
                    : "Inga nya orter — det överlevande bolaget fanns redan på dem"}
                </li>
                <li>{klart.flyttadeKontor} kontor flyttade</li>
                <li>{klart.flyttadeAdmins} administratörer flyttade</li>
              </ul>
              {klart.anmarkningar.length > 0 && (
                <ul className="confirm-company-list">
                  {klart.anmarkningar.map((a) => (
                    <li key={a} style={{ color: "var(--color-error)" }}>
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {!kvar.length ? (
        <div className="admin-panel">
          <p style={{ margin: 0 }}>Inga sammanslagningar väntar på granskning.</p>
        </div>
      ) : (
        kvar.map((a) => (
          <div className="admin-panel" key={a.id} style={{ marginBottom: 18 }}>
            <h3 className="admin-h3" style={{ marginTop: 0 }}>
              {a.upphorande?.name ?? "Okänt bolag"} → {a.overlevande?.name ?? "Okänt bolag"}
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 14px" }}>
              {a.skalText}
              {a.datum ? ` · från ${a.datum}` : ""}
              {a.skapat ? ` · begärt ${datum(a.skapat)}` : ""}
            </p>

            <div className="side-fact">
              <span className="k">Begärt av</span>
              <span className="v">
                {a.sokande || <em style={{ color: "var(--color-error)" }}>kontot hittades inte</em>}
                <span className={`ansokan-flagga ${a.sokandeDomanMatchar ? "ok" : "varning"}`}>
                  {a.sokandeDomanMatchar
                    ? "domänen matchar det överlevande bolaget"
                    : "domänen matchar INTE det överlevande bolaget"}
                </span>
              </span>
            </div>

            <div className="side-fact">
              <span className="k">Bolagen</span>
              <span className="v">
                <span className={`ansokan-flagga ${a.domanMatchar ? "ok" : "varning"}`}>
                  {a.domanMatchar
                    ? "bolagen delar webbplatsdomän"
                    : "bolagen delar INTE webbplatsdomän"}
                </span>
              </span>
            </div>

            <div className="side-fact">
              <span className="k">Upphör</span>
              <span className="v">
                {a.upphorande
                  ? `${a.upphorande.name} · ${a.upphorande.city} · ${a.upphorande.orgNumber || "utan org.nummer"} · id ${a.upphorande.id}`
                  : "—"}
                {a.upphorande?.claimed && <span className="ansokan-flagga varning">övertaget bolag</span>}
              </span>
            </div>

            <div className="side-fact">
              <span className="k">Lever vidare</span>
              <span className="v">
                {a.overlevande
                  ? `${a.overlevande.name} · ${a.overlevande.city} · ${a.overlevande.orgNumber || "utan org.nummer"} · id ${a.overlevande.id}`
                  : "—"}
              </span>
            </div>

            <div className="side-fact">
              <span className="k">Följer med</span>
              <span className="v">
                {[
                  a.arvdaOrter.length ? `orterna ${a.arvdaOrter.join(", ")}` : "inga nya orter",
                  `${a.upphorande?.kontor.length ?? 0} kontor`,
                  `${a.upphorande?.administratorer.length ?? 0} administratörer`,
                ].join(" · ")}
              </span>
            </div>

            <div className="side-fact">
              <span className="k">Historik</span>
              <span className="v">
                {a.upphorande?.antalForfragningar
                  ? `${a.upphorande.antalForfragningar} mottagna förfrågningar — ligger kvar på bolaget`
                  : "Inga mottagna förfrågningar"}
              </span>
            </div>

            {a.meddelande && (
              <div className="side-fact">
                <span className="k">Meddelande</span>
                <span className="v">{a.meddelande}</span>
              </div>
            )}

            {a.hinder.length > 0 && (
              <ul className="confirm-company-list" style={{ marginTop: 14 }}>
                {a.hinder.map((h) => (
                  <li key={h} style={{ color: "var(--color-error)" }}>
                    {h}
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
              <button
                className="qs-btn"
                style={{ width: "auto", padding: "11px 20px" }}
                disabled={arbetar || a.hinder.length > 0}
                onClick={() => oppna(a, "godkann")}
              >
                Godkänn sammanslagningen
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: "none", padding: "11px 20px" }}
                disabled={arbetar}
                onClick={() => oppna(a, "avsla")}
              >
                Neka
              </button>
            </div>

            {a.hinder.length > 0 && (
              <p className="admin-not">
                Godkännandet är avstängt tills hindren är undanröjda. Prenumerationer sägs upp av
                bolaget självt i Stripes portal — webhooken släcker flaggan när det är gjort.
              </p>
            )}
          </div>
        ))
      )}

      {bekraftar && (
        <div
          className="confirm-overlay"
          onClick={() => !arbetar && setBekraftar(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            {bekraftar.beslut === "avsla" ? (
              <>
                <h3>Neka sammanslagningen?</h3>
                <p className="sub">
                  {bekraftar.arende.upphorande?.name} och {bekraftar.arende.overlevande?.name} ligger
                  kvar var för sig. Båda bolagens administratörer får beskedet, med din anteckning om
                  du skriver en.
                </p>
              </>
            ) : (
              <>
                <h3>Slå ihop bolagen?</h3>
                <p className="sub">Det här händer när du bekräftar:</p>
                <ul className="confirm-company-list">
                  <li>
                    <strong>{bekraftar.arende.upphorande?.name}</strong> försvinner ur sökningen,
                    kartan och sitemapen
                  </li>
                  <li>
                    Adressen till profilen leder permanent till{" "}
                    <strong>{bekraftar.arende.overlevande?.name}</strong>
                  </li>
                  <li>
                    {bekraftar.arende.arvdaOrter.length
                      ? `Orterna ${bekraftar.arende.arvdaOrter.join(", ")} flyttas över, så ingen sökning tappar bolaget`
                      : "Inga nya orter — det överlevande bolaget finns redan på dem"}
                  </li>
                  <li>
                    {bekraftar.arende.upphorande?.kontor.length ?? 0} kontor och{" "}
                    {bekraftar.arende.upphorande?.administratorer.length ?? 0} administratörer flyttas
                    över
                  </li>
                  <li>
                    Mottagna förfrågningar ligger kvar på det upphörande bolaget — loggboken och
                    faktureringsunderlaget rörs inte
                  </li>
                  <li>Båda bolagens administratörer får beskedet</li>
                </ul>
                {bekraftar.arende.upphorande?.administratorer.length > 0 && (
                  <p className="sub">
                    Administratörerna som flyttas:{" "}
                    {bekraftar.arende.upphorande.administratorer
                      .map((adm) => adm.epost || "okänd adress")
                      .join(", ")}
                    . De kommer åt {bekraftar.arende.overlevande?.name} efteråt, men inte som ägare.
                  </p>
                )}
                {!bekraftar.arende.domanMatchar && (
                  <p className="sub" style={{ color: "var(--color-error)" }}>
                    Bolagen delar inte webbplatsdomän. Det är det enda maskinella stöd vi har för att
                    de hör ihop — kontrollera ägarförhållandet på annat sätt innan du godkänner.
                  </p>
                )}
                <p className="note">
                  Raden raderas inte. Ångrar du dig går sammanslagningen att ta tillbaka genom att
                  nollställa merged_into på bolaget.
                </p>
              </>
            )}

            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="beslutsnot">Anteckning till bolaget (frivillig)</label>
              <textarea
                id="beslutsnot"
                rows={3}
                value={not}
                maxLength={2000}
                onChange={(e) => setNot(e.target.value)}
                placeholder={
                  bekraftar.beslut === "avsla"
                    ? "Varför vi inte genomför den — det här är allt bolaget får veta."
                    : "Syns i beskedet till båda bolagen."
                }
              />
            </div>

            {fel && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{fel}</p>}

            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={arbetar}
                onClick={() => setBekraftar(null)}
              >
                Avbryt
              </button>
              <button className="qs-btn" type="button" disabled={arbetar} onClick={besluta}>
                {arbetar
                  ? "Arbetar…"
                  : bekraftar.beslut === "avsla"
                    ? "Bekräfta nekande"
                    : "Bekräfta sammanslagningen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
