"use client";

import { useCallback, useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token), []);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/kontakt/skicka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message, turnstileToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="auth-panel">
        <p>Tack! Vi har mottagit ditt meddelande och återkommer till dig snarast möjligt.</p>
      </div>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="contact-name">Namn</label>
        <input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="contact-email">E-post</label>
        <input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="contact-message">Meddelande</label>
        <textarea
          id="contact-message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          maxLength={2000}
          required
        />
        <div className="char-counter">{message.length}/2000 tecken</div>
      </div>
      <Turnstile onVerify={handleTurnstileVerify} />
      {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading" || (TURNSTILE_SITE_KEY && !turnstileToken)}>
        {status === "loading" ? "Skickar..." : "Skicka meddelande"}
      </button>
      <p style={{ fontStyle: "italic", fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
        Recruitable tar inte emot rekryteringsförfrågningar via det här formuläret. Vill ni skicka en förfrågan
        till bolag, använd <a href="/rekrytera">Rekrytera</a>-sidan istället.
      </p>
    </form>
  );
}
