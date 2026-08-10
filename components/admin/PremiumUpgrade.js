"use client";

import { useState } from "react";

export default function PremiumUpgrade() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleUpgrade() {
    setStatus("loading");
    setError("");
    const res = await fetch("/api/stripe/skapa-checkout", { method: "POST" });
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
      <p>
        Den utökade profilen (vision, medarbetare, undersökningar och mer) kräver en aktiv premium-prenumeration.
      </p>
      <button className="qs-btn" type="button" onClick={handleUpgrade} disabled={status === "loading"}>
        {status === "loading" ? "Öppnar kassan..." : "Uppgradera till Premium"}
      </button>
      {error && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
