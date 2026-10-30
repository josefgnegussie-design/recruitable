"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const KOD_RE = /^\d{6}$/;

// next kommer från inloggningssidan, redan granskad av sakerSokvag: vart
// besökaren var på väg när middlewaren skickade hit hen. Ett plattformsadmin-
// konto som landar på /mina-sidor skickas därifrån vidare till /admin.
//
// Två sätt att logga in: lösenord, eller en sexsiffrig kod som skickas till
// mejlen. Koden är till för den som glömt lösenordet eller aldrig satt något,
// t.ex. en inbjuden kollega. startlage väljer vilket formulär som visas först.
export default function LoginForm({ next, startlage = "losenord" }) {
  const router = useRouter();
  const [lage, setLage] = useState(startlage);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kod, setKod] = useState("");
  const [kodSkickad, setKodSkickad] = useState(false);
  const [error, setError] = useState("");
  const [besked, setBesked] = useState("");
  const [loading, setLoading] = useState(false);

  function vidareEfterInloggning() {
    router.push(next || "/mina-sidor");
    router.refresh();
  }

  function bytLage(nytt) {
    setLage(nytt);
    setError("");
    setBesked("");
    setKod("");
    setKodSkickad(false);
  }

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
    vidareEfterInloggning();
  }

  async function skickaKod(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setBesked("");
    const res = await fetch("/api/auth/kod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epost: email }),
    });
    setLoading(false);
    if (!res.ok) {
      const svar = await res.json().catch(() => ({}));
      setError(svar.error || "Kunde inte skicka koden. Försök igen.");
      return;
    }
    // Samma besked oavsett om adressen har ett konto — servern svarar likadant.
    setKodSkickad(true);
    setBesked(`Om ${email} har ett konto hos oss har vi skickat en sexsiffrig kod dit.`);
  }

  async function loggaInMedKod(e) {
    e.preventDefault();
    const rensad = kod.replace(/\s/g, "");
    if (!KOD_RE.test(rensad)) {
      setError("Koden är sex siffror.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: rensad, type: "email" });
    setLoading(false);
    if (error) {
      setError("Koden stämmer inte eller har gått ut. Kontrollera den eller skicka en ny.");
      return;
    }
    vidareEfterInloggning();
  }

  const lankar = (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 13 }}>
      <Link href="/glomt-losenord" style={{ color: "var(--color-muted)" }}>Glömt lösenord?</Link>
      <Link href="/for-bolag/registrera" style={{ color: "var(--color-muted)" }}>Skapa konto</Link>
    </div>
  );

  if (lage === "kod") {
    return (
      <form className="auth-panel" onSubmit={kodSkickad ? loggaInMedKod : skickaKod}>
        <div className="field">
          <label htmlFor="login-email">E-post</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={kodSkickad}
            required
          />
        </div>
        {kodSkickad && (
          <>
            {besked && <p role="status">{besked}</p>}
            <div className="field">
              <label htmlFor="login-kod">Kod från mejlet</label>
              <input
                id="login-kod"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                value={kod}
                onChange={(e) => setKod(e.target.value)}
                autoFocus
                required
              />
            </div>
          </>
        )}
        {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
        <button className="qs-btn" type="submit" disabled={loading}>
          {kodSkickad ? (loading ? "Loggar in..." : "Logga in") : loading ? "Skickar..." : "Skicka inloggningskod"}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14, fontSize: 13 }}>
          {kodSkickad ? (
            <>
              <button type="button" className="link-btn" disabled={loading} onClick={() => skickaKod()}>
                Skicka en ny kod
              </button>
              <button type="button" className="link-btn" onClick={() => bytLage("kod")}>
                Byt e-postadress
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => bytLage("losenord")}>
              Logga in med lösenord i stället
            </button>
          )}
        </div>
      </form>
    );
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
      <button
        type="button"
        className="link-btn"
        style={{ display: "block", margin: "14px auto 0" }}
        onClick={() => bytLage("kod")}
      >
        Logga in med en kod via mejl i stället
      </button>
      {lankar}
    </form>
  );
}
