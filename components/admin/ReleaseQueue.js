"use client";

import { useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

export default function ReleaseQueue({ initialQueue }) {
  const [queue, setQueue] = useState(initialQueue);
  const [releasingId, setReleasingId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  async function release(recipientId) {
    setReleasingId(recipientId);
    setErrorId(null);

    const res = await fetch("/api/admin/slapp-uppgifter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    });

    if (res.ok) {
      setQueue((prev) => prev.filter((item) => item.recipientId !== recipientId));
    } else {
      setErrorId(recipientId);
    }
    setReleasingId(null);
  }

  if (queue.length === 0) {
    return <p style={{ color: "var(--color-muted)" }}>Inget att granska just nu.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {queue.map((item) => (
        <div className="auth-panel" key={item.recipientId}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
                {item.requesterName} · {item.requesterCompany}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                {item.requesterCity} → accepterat av <b>{item.acceptedCompany}</b>
              </p>
            </div>
            <span style={{ fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
              {formatDate(item.createdAt)}
            </span>
          </div>

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5 }}>{item.description}</p>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={releasingId === item.recipientId}
              onClick={() => release(item.recipientId)}
            >
              {releasingId === item.recipientId ? "Släpper..." : "Släpp uppgifter"}
            </button>
            {errorId === item.recipientId && (
              <span style={{ color: "#c0392b", fontSize: 12.5 }}>Något gick fel, försök igen.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
