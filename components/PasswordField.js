"use client";

import { useState } from "react";

// Lösenordsfält med en visa-/dölj-knapp. Att kunna läsa det man skrivit fångar
// felstavningen direkt, och gör det andra "upprepa lösenordet"-fältet överflödigt
// — det fältet fångar ändå sällan något, eftersom de flesta klistrar in samma
// sträng i båda.
export default function PasswordField({ id, value, onChange, autoComplete = "new-password", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        {...props}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Dölj lösenordet" : "Visa lösenordet"}
      >
        {visible ? "Dölj" : "Visa"}
      </button>
    </div>
  );
}
