"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Formuläret på inbjudningssidan. Den som saknar konto väljer ett lösenord,
// eller går med utan och loggar in med en kod via mejl. Den som redan har ett
// konto går bara med och loggar sedan in som vanligt.
export default function InbjudanForm({ token, epost, harKonto }) {
  const router = useRouter();
  const [losenord, setLosenord] = useState("");
  const [losenordIgen, setLosenordIgen] = useState("");
  const [fel, setFel] = useState("");
  const [arbetar, setArbetar] = useState(false);

  async function ga(medLosenord) {
    setFel("");
    if (medLosenord) {
      if (losenord.length < 8) {
        setFel("Lösenordet måste vara minst 8 tecken.");
        return;
      }
      if (losenord !== losenordIgen) {
        setFel("Lösenorden stämmer inte överens.");
        return;
      }
    }

    setArbetar(true);
    const res = await fetch("/api/inbjudan/anta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, losenord: medLosenord ? losenord : null }),
    });
    const svar = await res.json().catch(() => ({}));

    if (!res.ok) {
      setArbetar(false);
      setFel(svar.error || "Något gick fel. Försök igen.");
      return;
    }

    if (svar.harLosenord) {
      const { error } = await createClient().auth.signInWithPassword({ email: epost, password: losenord });
      if (!error) {
        router.push("/mina-sidor");
        router.refresh();
        return;
      }
    }

    // Befintligt konto, eller inget lösenord valt: logga in som vanligt. Den
    // som inte valde lösenord får kodinloggningen direkt.
    router.push(`/logga-in?next=%2Fmina-sidor${harKonto ? "" : "&kod=1"}`);
  }

  if (harKonto) {
    return (
      <div className="auth-panel">
        <p>
          Du har redan ett konto som <strong>{epost}</strong>. Gå med, och logga sedan in med ditt lösenord eller en
          kod via mejl.
        </p>
        {fel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{fel}</p>}
        <button className="qs-btn" type="button" disabled={arbetar} onClick={() => ga(false)}>
          {arbetar ? "Går med…" : "Gå med och logga in"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="auth-panel"
      onSubmit={(e) => {
        e.preventDefault();
        ga(true);
      }}
    >
      <p>
        Du går med som <strong>{epost}</strong>. Välj ett lösenord, eller gå med utan och logga in med en kod som
        skickas till mejlen varje gång.
      </p>
      <div className="field">
        <label htmlFor="inbjudan-losenord">Lösenord</label>
        <input
          id="inbjudan-losenord"
          type="password"
          autoComplete="new-password"
          value={losenord}
          onChange={(e) => setLosenord(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="inbjudan-losenord-igen">Upprepa lösenordet</label>
        <input
          id="inbjudan-losenord-igen"
          type="password"
          autoComplete="new-password"
          value={losenordIgen}
          onChange={(e) => setLosenordIgen(e.target.value)}
          required
        />
      </div>
      {fel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{fel}</p>}
      <button className="qs-btn" type="submit" disabled={arbetar}>
        {arbetar ? "Går med…" : "Gå med"}
      </button>
      <button
        type="button"
        className="link-btn"
        style={{ display: "block", margin: "14px auto 0" }}
        disabled={arbetar}
        onClick={() => ga(false)}
      >
        Gå med utan lösenord och logga in med kod
      </button>
    </form>
  );
}
