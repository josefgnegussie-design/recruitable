"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/PasswordField";

export default function ResetPasswordForm() {
  const router = useRouter();
  // "kontrollerar" tills vi vet om länken gav en session, sedan "ok" eller
  // "ogiltig". Tidigare fanns bara ett ready-läge, vilket innebar att en
  // förbrukad länk lämnade användaren kvar på "Kontrollerar länken..." för
  // alltid, utan att säga vad som gått fel.
  const [lankLage, setLankLage] = useState("kontrollerar");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    // /auth/confirm skickar hit med ?fel=lank när token-hashen inte gick att
    // lösa in. Läses direkt ur adressen i stället för med useSearchParams, som
    // hade krävt en Suspense-gräns runt formuläret.
    if (new URLSearchParams(window.location.search).get("fel") === "lank") {
      setLankLage("ogiltig");
      return;
    }

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setLankLage("ok");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setLankLage("ok");
    });

    // Normalfallet är att /auth/confirm redan lagt sessionen i cookies, så
    // getSession svarar direkt. Fristen finns för länkar av den äldre sorten,
    // där webbläsarklienten själv växlar in en ?code= i adressen först.
    const timer = setTimeout(() => {
      setLankLage((nuvarande) => (nuvarande === "kontrollerar" ? "ogiltig" : nuvarande));
    }, 3000);

    return () => {
      clearTimeout(timer);
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

  if (lankLage === "kontrollerar") {
    return (
      <div className="auth-panel">
        <p>Kontrollerar länken...</p>
      </div>
    );
  }

  if (lankLage === "ogiltig") {
    return (
      <div className="auth-panel">
        <p>Länken är förbrukad eller har gått ut. Återställningslänkar gäller en kort stund och bara en gång.</p>
        <p>
          <a href="/glomt-losenord">Begär en ny länk</a>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="new-password">Nytt lösenord</label>
        <PasswordField
          id="new-password"
          value={password}
          onChange={setPassword}
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
