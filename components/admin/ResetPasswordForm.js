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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });

    async function checkLink() {
      // Biblioteket försöker självt hantera länken (både äldre hash-baserade
      // och nyare kodbaserade återställningslänkar) direkt när klienten
      // skapas — vänta en kort stund på det INNAN vi rör koden själva.
      // Återställningskoder går bara att lösa in en gång; om vi också
      // försöker samtidigt konsumeras den två gånger och det andra
      // försöket misslyckas alltid med "länken har gått ut".
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setReady(true);
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeError) {
          setLinkError("Länken har gått ut eller är ogiltig — begär en ny återställningslänk.");
          return;
        }
        setReady(true);
        return;
      }

      // Varken en redan upprättad session eller en kod i URL:en — länken är
      // ogiltig. Visa ett fel istället för att hänga kvar på "Kontrollerar
      // länken..." för evigt.
      timeout = setTimeout(() => {
        if (cancelled) return;
        setReady((current) => {
          if (!current) setLinkError("Länken har gått ut eller är ogiltig — begär en ny återställningslänk.");
          return current;
        });
      }, 2000);
    }

    checkLink();

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
