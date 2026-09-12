"use client";

import { useState } from "react";

const TOMT = { city: "", address: "", contactName: "", contactEmail: "" };

function franKontor(k) {
  return {
    city: k.city || "",
    address: k.address || "",
    contactName: k.contact_name || "",
    contactEmail: k.contact_email || "",
  };
}

// Kontoren höll tidigare i en useState utan setter, så listan gick bara att
// lägga till i — aldrig ändra eller ta bort. Ett felstavat kontaktmejl gick
// därmed inte att rätta, trots att det är den adressen som tar emot ortens
// förfrågningar.
export default function OfficesManager({ offices: initialOffices }) {
  const [offices, setOffices] = useState(initialOffices);
  const [showForm, setShowForm] = useState(false);
  const [nytt, setNytt] = useState(TOMT);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Id:t på det kontor som redigeras, plus dess utkast. Bara ett i taget —
  // två öppna formulär i samma lista blir svårt att överblicka.
  const [redigerar, setRedigerar] = useState(null);
  const [utkast, setUtkast] = useState(TOMT);
  const [radStatus, setRadStatus] = useState("idle");
  const [radFel, setRadFel] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/stripe/skapa-kontor-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: nytt.city,
        address: nytt.address || undefined,
        contactName: nytt.contactName,
        contactEmail: nytt.contactEmail,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.url) {
      setStatus("error");
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }

    window.location.href = body.url;
  }

  function borjaRedigera(kontor) {
    setRedigerar(kontor.id);
    setUtkast(franKontor(kontor));
    setRadStatus("idle");
    setRadFel("");
  }

  async function sparaRad(e, officeId) {
    e.preventDefault();
    setRadStatus("sparar");
    setRadFel("");

    const res = await fetch("/api/mina-sidor/kontor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeId, ...utkast }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRadStatus("idle");
      setRadFel(body.error || "Kunde inte spara. Försök igen.");
      return;
    }

    setOffices((prev) => prev.map((k) => (k.id === officeId ? body.kontor : k)));
    setRedigerar(null);
    setRadStatus("idle");
  }

  async function taBort(kontor) {
    setRadStatus("tar-bort");
    setRadFel("");

    const res = await fetch("/api/mina-sidor/kontor", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeId: kontor.id }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRadStatus("idle");
      setRadFel(body.error || "Kunde inte ta bort. Försök igen.");
      return;
    }

    setOffices((prev) => prev.filter((k) => k.id !== kontor.id));
    setRedigerar(null);
    setRadStatus("idle");
  }

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ color: "var(--color-muted)", marginBottom: 20 }}>
        Varje ytterligare kontor utöver huvudkontoret är en egen betald plats. Förfrågningar från ett kontors ort
        går direkt till kontorets egen kontaktperson istället för till er generella kontakt.
      </p>

      {offices.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>Inga kontor tillagda än.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {offices.map((office) =>
            redigerar === office.id ? (
              <form className="auth-panel" key={office.id} onSubmit={(e) => sparaRad(e, office.id)}>
                <div className="field">
                  <label htmlFor={`kontor-ort-${office.id}`}>Ort</label>
                  <input
                    id={`kontor-ort-${office.id}`}
                    value={utkast.city}
                    onChange={(e) => setUtkast({ ...utkast, city: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`kontor-adress-${office.id}`}>Adress (valfritt)</label>
                  <input
                    id={`kontor-adress-${office.id}`}
                    value={utkast.address}
                    onChange={(e) => setUtkast({ ...utkast, address: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`kontor-namn-${office.id}`}>Kontaktperson</label>
                  <input
                    id={`kontor-namn-${office.id}`}
                    value={utkast.contactName}
                    onChange={(e) => setUtkast({ ...utkast, contactName: e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`kontor-mejl-${office.id}`}>Kontaktpersonens e-post</label>
                  <input
                    id={`kontor-mejl-${office.id}`}
                    type="email"
                    value={utkast.contactEmail}
                    onChange={(e) => setUtkast({ ...utkast, contactEmail: e.target.value })}
                    required
                  />
                  <p className="hint">Hit går förfrågningar från {utkast.city || "kontorets ort"}.</p>
                </div>

                {radFel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{radFel}</p>}

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setRedigerar(null)}
                    disabled={radStatus !== "idle"}
                  >
                    Avbryt
                  </button>
                  <button type="submit" className="qs-btn" disabled={radStatus !== "idle"}>
                    {radStatus === "sparar" ? "Sparar..." : "Spara"}
                  </button>
                  <button
                    type="button"
                    className="kontor-ta-bort"
                    onClick={() => taBort(office)}
                    disabled={radStatus !== "idle"}
                  >
                    {radStatus === "tar-bort" ? "Tar bort..." : "Ta bort kontoret"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="auth-panel" key={office.id}>
                <div className="kontor-topp">
                  <div className="kontor-info">
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15.5 }}>
                      {office.city}
                      {office.is_headquarters && <span className="kontor-hk">Huvudkontor</span>}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                      {office.contact_name} · {office.contact_email}
                    </p>
                    {office.address && (
                      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-muted)" }}>{office.address}</p>
                    )}
                  </div>
                  <span className={`kontor-status${office.paid ? " betalt" : ""}`}>
                    {office.paid ? "Betalt" : "Väntar betalning"}
                  </span>
                </div>
                <button type="button" className="link-btn" style={{ marginTop: 12 }} onClick={() => borjaRedigera(office)}>
                  Ändra
                </button>
              </div>
            )
          )}
        </div>
      )}

      {showForm ? (
        <form className="auth-panel" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="office-city">Ort</label>
            <input
              id="office-city"
              value={nytt.city}
              onChange={(e) => setNytt({ ...nytt, city: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="office-address">Adress (valfritt)</label>
            <input
              id="office-address"
              value={nytt.address}
              onChange={(e) => setNytt({ ...nytt, address: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="office-contact-name">Kontaktperson</label>
            <input
              id="office-contact-name"
              value={nytt.contactName}
              onChange={(e) => setNytt({ ...nytt, contactName: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="office-contact-email">Kontaktpersonens e-post</label>
            <input
              id="office-contact-email"
              type="email"
              value={nytt.contactEmail}
              onChange={(e) => setNytt({ ...nytt, contactEmail: e.target.value })}
              required
            />
          </div>
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={status === "loading"}>
              Avbryt
            </button>
            <button type="submit" className="qs-btn" disabled={status === "loading"}>
              {status === "loading" ? "Öppnar kassan..." : "Gå till betalning"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="qs-btn" onClick={() => setShowForm(true)}>
          Lägg till kontor
        </button>
      )}
    </div>
  );
}
