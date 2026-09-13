"use client";

import { useState } from "react";

// Kön över bolag som Bolagsverket säger är avregistrerade.
//
// Tre vägar ut, och valet går inte att automatisera: gick verksamheten över till
// ett annat bolag ska profilen peka dit, upphörde den ska profilen ligga kvar och
// säga det, och är organisationsnumret i vårt register fel ska bolaget stå kvar.
// Avregistreringen i sig skiljer inte på fallen.
export default function AvregistreradeKo({ bolag }) {
  const [kvar, setKvar] = useState(bolag);
  const [arbetar, setArbetar] = useState(null);
  const [fel, setFel] = useState("");
  const [besked, setBesked] = useState("");

  // Valt överlevande bolag per rad, för den som ska slås ihop.
  const [valt, setValt] = useState({});
  const [traffar, setTraffar] = useState({});
  const [soker, setSoker] = useState(null);
  const [bekraftar, setBekraftar] = useState(null);

  async function sok(companyId, fraga) {
    if (fraga.trim().length < 2) {
      setTraffar((t) => ({ ...t, [companyId]: null }));
      return;
    }
    setSoker(companyId);
    try {
      const res = await fetch(`/api/admin/bolag-sok?q=${encodeURIComponent(fraga)}`);
      const body = await res.json();
      setTraffar((t) => ({ ...t, [companyId]: res.ok ? body.traffar || [] : [] }));
    } catch {
      setTraffar((t) => ({ ...t, [companyId]: [] }));
    } finally {
      setSoker(null);
    }
  }

  async function besluta() {
    const { b, atgard } = bekraftar;
    setArbetar(b.id);
    setFel("");

    const res = await fetch("/api/admin/avregistrerad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: b.id, atgard, survivorId: valt[b.id]?.id ?? null }),
    });

    const svar = await res.json().catch(() => ({}));
    setArbetar(null);

    if (!res.ok) {
      setFel(svar.error || "Något gick fel. Försök igen.");
      setBekraftar(null);
      return;
    }

    setBekraftar(null);
    setKvar((prev) => prev.filter((rad) => rad.id !== b.id));
    setBesked(
      atgard === "behall"
        ? `${b.name} står kvar i registret.`
        : atgard === "ta-ur"
          ? `${b.name} är taget ur registret. Profilen ligger kvar och visar att bolaget avregistrerats.`
          : `${b.name} är sammanslaget med ${valt[b.id]?.name}.` +
            (svar.arvdaOrter?.length ? ` Orterna ${svar.arvdaOrter.join(", ")} följde med.` : "")
    );
  }

  if (!kvar.length) {
    return (
      <div className="admin-panel">
        <p style={{ margin: 0 }}>
          Inga avregistrerade bolag väntar på beslut.
          {besked && ` ${besked}`}
        </p>
      </div>
    );
  }

  return (
    <div>
      {fel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{fel}</p>}
      {besked && <p style={{ color: "var(--color-success)", fontSize: 13 }}>{besked}</p>}

      {kvar.map((b) => (
        <div className="admin-panel" key={b.id} style={{ marginBottom: 18 }}>
          <h3 className="admin-h3" style={{ marginTop: 0 }}>
            {b.name}
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 14px" }}>
            {b.orgNumber} · {b.city} · id {b.id}
            {b.claimed ? " · övertagen profil" : ""}
          </p>

          <div className="side-fact">
            <span className="k">Avregistrerat</span>
            <span className="v">
              {b.deregisteredAt} enligt Bolagsverket
              {b.ejVerksamt && <span className="ansokan-flagga varning">inte verksamt</span>}
            </span>
          </div>
          <div className="side-fact">
            <span className="k">Påverkar</span>
            <span className="v">
              {[
                `${b.antalAdmins} administratörer`,
                `${b.antalKontor} kontor`,
                `${b.antalForfragningar} mottagna förfrågningar`,
              ].join(" · ")}
            </span>
          </div>

          {b.hinder.length > 0 && (
            <ul className="confirm-company-list" style={{ marginTop: 14 }}>
              {b.hinder.map((h) => (
                <li key={h} style={{ color: "var(--color-error)" }}>
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Efterträdaren är frivillig. Det vanliga efter en avregistrering är att
              bolaget bara upphört — men har verksamheten gått över till ett annat
              bolag ska profilen peka dit i stället för att bli en återvändsgränd. */}
          <details className="koppla-sok" style={{ marginTop: 14 }}>
            <summary>
              {valt[b.id]
                ? `Verksamheten gick över till ${valt[b.id].name}`
                : "Gick verksamheten över till ett annat bolag?"}
            </summary>
            {valt[b.id] ? (
              <p style={{ fontSize: 13.5, margin: "0 0 8px" }}>
                <strong>{valt[b.id].name}</strong> ({valt[b.id].city}, id {valt[b.id].id}){" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setValt((v) => ({ ...v, [b.id]: undefined }))}
                >
                  Ångra valet
                </button>
              </p>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Namn eller organisationsnummer"
                  onChange={(e) => sok(b.id, e.target.value)}
                  aria-label="Sök bolag i registret"
                />
                {soker === b.id && <p className="note">Söker…</p>}
                {traffar[b.id]?.length === 0 && soker !== b.id && (
                  <p className="note">Inga träffar i registret.</p>
                )}
                {traffar[b.id]?.length > 0 && (
                  <ul className="koppla-traffar">
                    {traffar[b.id]
                      .filter((t) => t.id !== b.id)
                      .map((t) => (
                        <li key={t.id}>
                          <button type="button" onClick={() => setValt((v) => ({ ...v, [b.id]: t }))}>
                            <span className="lookup-name">{t.name}</span>
                            <span className="lookup-meta">
                              {[t.city, t.org_number || "utan org.nummer", `id ${t.id}`].join(" · ")}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </>
            )}
          </details>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <button
              className="qs-btn"
              style={{ width: "auto", padding: "11px 20px" }}
              disabled={arbetar === b.id || b.hinder.length > 0}
              onClick={() => setBekraftar({ b, atgard: valt[b.id] ? "sla-ihop" : "ta-ur" })}
            >
              {valt[b.id] ? `Slå ihop med ${valt[b.id].name}` : "Ta ur registret"}
            </button>
            <button
              className="btn btn-ghost"
              style={{ flex: "none", padding: "11px 20px" }}
              disabled={arbetar === b.id}
              onClick={() => setBekraftar({ b, atgard: "behall" })}
            >
              Låt stå kvar
            </button>
          </div>

          {b.hinder.length > 0 && (
            <p className="admin-not">
              Beslutet är avstängt tills hindren är undanröjda — en prenumeration som löper vidare mot
              ett bolag som inte visas debiteras ändå.
            </p>
          )}
        </div>
      ))}

      {bekraftar && (
        <div
          className="confirm-overlay"
          onClick={() => arbetar === null && setBekraftar(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            {bekraftar.atgard === "behall" ? (
              <>
                <h3>Låt {bekraftar.b.name} stå kvar?</h3>
                <p className="sub">
                  Bolaget fortsätter visas i registret som vanligt. Uppgiften om avregistreringen
                  ligger kvar, men ärendet lämnar kön och kommer inte tillbaka.
                </p>
                <p className="note">
                  Välj det här när organisationsnumret i vårt register pekar på fel bolag — då är det
                  numret som ska rättas, inte kortet som ska bort.
                </p>
              </>
            ) : bekraftar.atgard === "ta-ur" ? (
              <>
                <h3>Ta {bekraftar.b.name} ur registret?</h3>
                <p className="sub">Det här händer när du bekräftar:</p>
                <ul className="confirm-company-list">
                  <li>Bolaget försvinner ur sökningen, kartan och sitemapen</li>
                  <li>
                    Profilen ligger kvar och visar att bolaget avregistrerades{" "}
                    {bekraftar.b.deregisteredAt} — den som söker efter bolaget får veta vad som hänt
                  </li>
                  <li>Bolaget kan inte längre väljas som mottagare av en förfrågan</li>
                  <li>
                    {bekraftar.b.antalForfragningar} mottagna förfrågningar ligger kvar — loggboken
                    och faktureringsunderlaget rörs inte
                  </li>
                  {bekraftar.b.antalAdmins > 0 && (
                    <li>
                      {bekraftar.b.antalAdmins} administratörer behåller sin inloggning och sin
                      profil — det finns inget bolag att flytta dem till
                    </li>
                  )}
                </ul>
                <p className="note">Raden raderas inte. Beslutet går att ta tillbaka.</p>
              </>
            ) : (
              <>
                <h3>Slå ihop med {valt[bekraftar.b.id]?.name}?</h3>
                <p className="sub">
                  {bekraftar.b.name} slutar visas och adressen leder permanent till{" "}
                  {valt[bekraftar.b.id]?.name}. Orter, kontor och administratörer följer med, så
                  ingen ort försvinner ur sökningen och ingen blir utan konto.
                </p>
                <p className="note">
                  Kontrollera att verksamheten verkligen gick över dit. En avregistrering säger bara
                  att bolaget upphört, inte vart det tog vägen.
                </p>
              </>
            )}

            {fel && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{fel}</p>}

            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={arbetar !== null}
                onClick={() => setBekraftar(null)}
              >
                Avbryt
              </button>
              <button className="qs-btn" type="button" disabled={arbetar !== null} onClick={besluta}>
                {arbetar !== null ? "Arbetar…" : "Bekräfta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
