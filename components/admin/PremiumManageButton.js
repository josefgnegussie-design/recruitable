"use client";

import { useState } from "react";

export default function PremiumManageButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleManage() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !body.url) {
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }
    window.location.href = body.url;
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <button type="button" className="link-btn" onClick={handleManage} disabled={loading}>
        {loading ? "Öppnar..." : "Hantera prenumeration"}
      </button>
      {error && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
