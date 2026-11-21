"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Knappen som släpper förfrågan. Den som kommer hit har följt länken i mejlet
// till avsändaren, vilket visar att adressen är deras. Själva bekräftelsen är
// ett eget klick och inte länken, så att e-postskydd som öppnar länkar i
// förväg inte bekräftar åt någon.
export default function BekraftaForfragan({ token, bekrafta, antal }) {
  const router = useRouter();
  const pathname = usePathname();
  const [skickar, setSkickar] = useState(false);
  const [fel, setFel] = useState("");

  async function bekraftaNu() {
    setSkickar(true);
    setFel("");
    const res = await fetch("/api/forfragan/bekrafta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, bekrafta }),
    }).catch(() => null);
    const svar = await res?.json().catch(() => ({}));

    if (!res?.ok) {
      setSkickar(false);
      setFel(svar?.error || "Något gick fel. Försök igen.");
      return;
    }
    // Tokenen tas bort ur adressen, så att sidan som sparas eller delas är den
    // vanliga uppföljningssidan.
    router.replace(pathname);
    router.refresh();
  }

  return (
    <div className="auth-panel bekrafta-panel">
      <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.5 }}>
        {`Förfrågan skickas till ${antal} bolag när du bekräftar. De ser behovet, men dina kontaktuppgifter först när de tackar ja.`}
      </p>
      <button className="qs-btn" type="button" onClick={bekraftaNu} disabled={skickar}>
        {skickar ? "Skickar..." : "Bekräfta och skicka"}
      </button>
      {fel && (
        <p className="field-error" role="alert" style={{ marginTop: 10 }}>
          {fel}
        </p>
      )}
    </div>
  );
}
