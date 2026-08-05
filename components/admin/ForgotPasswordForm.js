"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/aterstall-losenord`,
    });
    if (error) {
      setStatus("error");
      setError("Något gick fel. Försök igen.");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="auth-panel">
        <p>Om det finns ett konto med den e-postadressen har vi skickat en länk för att återställa lösenordet.</p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="forgot-email">E-post</label>
        <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Skickar..." : "Skicka återställningslänk"}
      </button>
    </form>
  );
}
