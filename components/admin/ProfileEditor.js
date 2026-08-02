"use client";

import { useState } from "react";

export default function ProfileEditor({ company }) {
  const [extendedVision, setExtendedVision] = useState(company.extended_vision || "");
  const [status, setStatus] = useState("idle");

  async function handleSave(e) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/profil/spara", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: company.id, extendedVision }),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <h1 className="hero-title" style={{ fontSize: 28 }}>
        Redigera profil — {company.name}
      </h1>
      <form className="auth-panel" onSubmit={handleSave} style={{ marginTop: 24 }}>
        <div className="field">
          <label htmlFor="extended-vision">Utökad vision/beskrivning</label>
          <textarea
            id="extended-vision"
            rows={6}
            value={extendedVision}
            onChange={(e) => setExtendedVision(e.target.value)}
          />
        </div>
        <button className="qs-btn" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Sparar..." : "Spara"}
        </button>
        {status === "saved" && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>Sparat!</p>}
        {status === "error" && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>Något gick fel.</p>}
      </form>
    </div>
  );
}
