"use client";

import { useState } from "react";
import { COMPANIES } from "@/lib/companies";
import { createClient } from "@/lib/supabase/client";

export default function RegisterForm() {
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setStatus("error");
      setErrorMsg("Något gick fel vid registreringen. Försök igen.");
      return;
    }

    const res = await fetch("/api/auth/registrera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, companyId: Number(companyId), name, email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMsg(body.error || "Något gick fel. Kontakta info@recruitable.se.");
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="auth-panel">
        <p>
          Tack! Kolla din e-post för att bekräfta kontot. När det är gjort granskar vi din begäran manuellt
          — ni får besked så snart kontot är godkänt.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="reg-company">Bolag</label>
        <select id="reg-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
          <option value="" disabled>Välj ert bolag</option>
          {COMPANIES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="reg-name">Ditt namn</label>
        <input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="reg-email">E-post (företagsadress)</label>
        <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
          Måste matcha samma domän som bolagets webbplats i registret.
        </p>
      </div>
      <div className="field">
        <label htmlFor="reg-password">Lösenord</label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {status === "error" && <p style={{ color: "#c0392b", fontSize: 13 }}>{errorMsg}</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Skickar..." : "Begär tillgång"}
      </button>
    </form>
  );
}
