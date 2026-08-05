"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Fel e-post eller lösenord.");
      return;
    }
    router.push("/mina-sidor");
    router.refresh();
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="login-email">E-post</label>
        <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="login-password">Lösenord</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <button className="qs-btn" type="submit" disabled={loading}>
        {loading ? "Loggar in..." : "Logga in"}
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 13 }}>
        <Link href="/glomt-losenord" style={{ color: "var(--color-muted)" }}>Glömt lösenord?</Link>
        <Link href="/for-bolag/registrera" style={{ color: "var(--color-muted)" }}>Skapa konto</Link>
      </div>
    </form>
  );
}
