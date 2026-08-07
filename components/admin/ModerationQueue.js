"use client";

import { useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

export default function ModerationQueue({ initialQueue }) {
  const [queue, setQueue] = useState(initialQueue);
  const [decidingId, setDecidingId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  async function decide(inquiryId, decision) {
    setDecidingId(inquiryId);
    setErrorId(null);

    const res = await fetch("/api/admin/moderera-forfragan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, decision }),
    });

    if (res.ok) {
      setQueue((prev) => prev.filter((item) => item.inquiryId !== inquiryId));
    } else {
      setErrorId(inquiryId);
    }
    setDecidingId(null);
  }

  if (queue.length === 0) {
    return <p style={{ color: "var(--color-muted)" }}>Inget att granska just nu.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {queue.map((item) => (
        <div className="auth-panel" key={item.inquiryId}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
                {item.requesterName} · {item.requesterCompany}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                {item.requesterRole} · {item.requesterCity} ·{" "}
                <a href={`mailto:${item.requesterEmail}`}>{item.requesterEmail}</a> ·{" "}
                <a href={`https://${item.requesterWebsite.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                  {item.requesterWebsite}
                </a>
                {item.requesterPhone && (
                  <>
                    {" · "}
                    <a href={`tel:${item.requesterPhone}`}>{item.requesterPhone}</a>
                  </>
                )}
              </p>
            </div>
            <span style={{ fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
              {formatDate(item.createdAt)}
            </span>
          </div>

          {(item.searchRole || item.focusArea || item.service) && (
            <div className="tag-row" style={{ marginTop: 10 }}>
              {item.searchRole && <span className="tag">{item.searchRole}</span>}
              {item.focusArea && <span className="tag">{item.focusArea}</span>}
              {item.service && <span className="tag">{item.service}</span>}
            </div>
          )}

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5 }}>{item.description}</p>

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--color-muted)" }}>
            Skickas till: <b>{item.companies.join(", ") || "—"}</b>
          </p>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={decidingId === item.inquiryId}
              onClick={() => decide(item.inquiryId, "approved")}
            >
              {decidingId === item.inquiryId ? "..." : "Godkänn"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={decidingId === item.inquiryId}
              onClick={() => decide(item.inquiryId, "rejected")}
            >
              Neka
            </button>
            {errorId === item.inquiryId && (
              <span style={{ color: "#c0392b", fontSize: 12.5 }}>Något gick fel, försök igen.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
