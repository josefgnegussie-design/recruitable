"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timeout = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Nyare Supabase-projekt skickar återställningskoden som ?code=... i
    // stället för i URL-hashen — då krävs ett uttryckligt utbyte, annars
    // hänger sidan kvar på "Kontrollerar länken..." utan felmeddelande om
    // det misslyckas (t.ex. länken öppnad i en annan webbläsare/enhet än
    // den återställningen begärdes från).
    const code = new URLSearchParams(window.location.search).get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (cancelled) return;
        if (exchangeError) {
          setLinkError("Länken har gått ut eller är ogiltig — begär en ny återställningslänk.");
          return;
        }
        setReady(true);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        if (session) setReady(true);
      });

      // Hash-baserade länkar (äldre flöde) hanteras automatiskt av
      // biblioteket vid sidladdning — ge det en kort stund, annars visa
      // ett fel istället för att hänga kvar för evigt.
      timeout = setTimeout(() => {
        if (cancelled) return;
        setReady((current) => {
          if (!current) setLinkError("Länken har gått ut eller är ogiltig — begär en ny återställningslänk.");
          return current;
        });
      }, 4000);
    }

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
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

  if (linkError) {
    return (
      <div className="auth-panel">
        <p style={{ color: "#c0392b" }}>{linkError}</p>
        <a className="qs-btn" href="/glomt-losenord" style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
          Begär ny länk
        </a>
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
