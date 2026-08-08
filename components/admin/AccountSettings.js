"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (password !== confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setStatus("loading");
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setStatus("error");
      setError("Något gick fel. Försök igen.");
      return;
    }
    setStatus("success");
    setPassword("");
    setConfirm("");
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="acc-new-password">Nytt lösenord</label>
        <input
          id="acc-new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="acc-confirm-password">Bekräfta nytt lösenord</label>
        <input
          id="acc-confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      {status === "success" && <p style={{ color: "var(--color-accent)", fontSize: 13 }}>Lösenordet är uppdaterat.</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sparar..." : "Byt lösenord"}
      </button>
    </form>
  );
}

function TeamManager({ initialMembers }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    const res = await fetch("/api/mina-sidor/konto/lagg-till-anvandare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }
    setMembers((prev) => [...prev, { id: body.email, email: body.email, isSelf: false, pendingRefresh: true }]);
    setEmail("");
    setStatus("success");
  }

  async function handleRemove(id) {
    if (!confirm("Ta bort den här personens åtkomst till bolaget?")) return;
    setRemovingId(id);
    setError("");
    const res = await fetch("/api/mina-sidor/konto/ta-bort-anvandare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminRowId: id }),
    });
    const body = await res.json().catch(() => ({}));
    setRemovingId(null);
    if (!res.ok) {
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div style={{ marginTop: 40 }}>
      <h3 style={{ fontSize: 17, marginBottom: 4 }}>Användare med åtkomst</h3>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 16 }}>
        Alla i listan kan logga in och se bolagets förfrågningar.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid var(--color-hairline)",
            }}
          >
            <span>
              {m.email}
              {m.isSelf && <span style={{ color: "var(--color-muted)", fontSize: 12 }}> (du)</span>}
              {m.pendingRefresh && (
                <span style={{ color: "var(--color-muted)", fontSize: 12 }}> (synlig efter omladdning)</span>
              )}
            </span>
            {!m.isSelf && !m.pendingRefresh && (
              <button
                type="button"
                className="link-btn"
                onClick={() => handleRemove(m.id)}
                disabled={removingId === m.id}
              >
                {removingId === m.id ? "Tar bort..." : "Ta bort"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3 style={{ fontSize: 17, marginBottom: 4 }}>Lägg till användare</h3>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 16 }}>
        Personen måste redan ha ett eget konto (via{" "}
        <a href="/for-bolag/registrera">Skapa konto</a>) innan de kan kopplas till bolaget.
      </p>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, maxWidth: 420 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="kollega@erabolag.se"
          required
          style={{ flex: 1 }}
        />
        <button className="qs-btn" type="submit" disabled={status === "loading"} style={{ whiteSpace: "nowrap" }}>
          {status === "loading" ? "Lägger till..." : "Lägg till"}
        </button>
      </form>
      {error && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}

export default function AccountSettings({ teamMembers }) {
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 17, marginBottom: 16 }}>Byt lösenord</h3>
      <ChangePasswordForm />
      <TeamManager initialMembers={teamMembers} />
    </div>
  );
}
