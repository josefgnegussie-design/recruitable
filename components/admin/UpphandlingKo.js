"use client";

import { useState } from "react";
import { datumText } from "@/lib/upphandling";

export default function UpphandlingKo({ initialKo }) {
  const [ko, setKo] = useState(initialKo);
  const [arbetarMed, setArbetarMed] = useState(null);
  const [felId, setFelId] = useState(null);
  const [kvitto, setKvitto] = useState("");

  async function besluta(id, beslut) {
    setArbetarMed(id);
    setFelId(null);
    const res = await fetch("/api/admin/moderera-upphandling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, beslut }),
    });
    setArbetarMed(null);
    if (!res.ok) return setFelId(id);

    const data = await res.json().catch(() => ({}));
    setKvitto(
      beslut === "approved"
        ? `Publicerad. Mejl gick till ${data.mejlade ?? 0} bolag med matchande yrkesområde.`
        : "Nekad. Köparen har fått besked."
    );
    setKo((l) => l.filter((u) => u.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {kvitto && <p style={{ fontSize: 13, margin: 0 }}>{kvitto}</p>}
      {ko.length === 0 && <p style={{ color: "var(--color-muted)" }}>Inget att granska just nu.</p>}
      {ko.map((u) => (
        <div className="auth-panel" key={u.id}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{u.title}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
            {u.requester_company} · {u.requester_name}, {u.requester_role} ·{" "}
            <a href={`mailto:${u.requester_email}`}>{u.requester_email}</a> ·{" "}
            <a href={`https://${u.requester_website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
              {u.requester_website}
            </a>
          </p>
          <div className="tag-row" style={{ marginTop: 10 }}>
            <span className="tag">{u.service}</span>
            <span className="tag">{u.buyer_type === "offentlig" ? "Offentlig, marknadsdialog" : "Privat"}</span>
            <span className="tag">{u.name_visibility === "direkt" ? "Namn synligt" : "Namn dolt"}</span>
            {u.focus_areas.map((o) => (
              <span className="tag" key={o}>{o}</span>
            ))}
          </div>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>Visas som: {u.buyer_description}</p>
          <p style={{ marginTop: 8, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{u.description}</p>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--color-muted)" }}>
            {u.cities.join(", ")} · {u.competences.join(", ")} · sista dag {datumText(u.interest_deadline)}
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" className="btn btn-primary" disabled={arbetarMed === u.id} onClick={() => besluta(u.id, "approved")}>
              {arbetarMed === u.id ? "..." : "Godkänn"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={arbetarMed === u.id} onClick={() => besluta(u.id, "rejected")}>
              Neka
            </button>
            {felId === u.id && <span style={{ color: "#c0392b", fontSize: 12.5 }}>Något gick fel, försök igen.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
