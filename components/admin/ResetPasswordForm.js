"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setError("Något gick fel. Länken kan ha gått ut — begär en ny.");
      return;
    }
    setStatus("success");
    setTimeout(() => router.push("/logga-in"), 2000);
  }

  if (status === "success") {
    return (
      <div className="auth-panel">
        <p>Lösenordet är uppdaterat. Du skickas vidare till inloggningen...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="auth-panel">
        <p>Kontrollerar länken...</p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="new-password">Nytt lösenord</label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sparar..." : "Uppdatera lösenord"}
      </button>
    </form>
  );
}
