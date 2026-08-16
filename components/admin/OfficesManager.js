"use client";

import { useState } from "react";

export default function OfficesManager({ offices: initialOffices }) {
  const [offices] = useState(initialOffices);
  const [showForm, setShowForm] = useState(false);
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/stripe/skapa-kontor-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city,
        address: address || undefined,
        contactName,
        contactEmail,
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
          {offices.map((office) => (
            <div className="auth-panel" key={office.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15.5 }}>{office.city}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                    {office.contact_name} · {office.contact_email}
                  </p>
                  {office.address && (
                    <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-muted)" }}>{office.address}</p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    padding: "3px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    background: office.paid ? "rgba(63,143,95,0.12)" : "rgba(184,67,58,0.1)",
                    color: office.paid ? "#3f8f5f" : "#b8433a",
                  }}
                >
                  {office.paid ? "Betalt" : "Väntar betalning"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form className="auth-panel" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="office-city">Ort</label>
            <input id="office-city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="office-address">Adress (valfritt)</label>
            <input id="office-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="office-contact-name">Kontaktperson</label>
            <input
              id="office-contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="office-contact-email">Kontaktpersonens e-post</label>
            <input
              id="office-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
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
