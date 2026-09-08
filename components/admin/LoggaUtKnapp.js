"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Utloggning. Fanns tidigare inte någonstans i appen — den som loggat in blev
// kvar tills sessionen gick ut av sig själv, oavsett om det var en delad dator.
//
// Ligger i webbläsarklienten med flit: det är den som äger sessionskakan, och
// signOut() river både den och den aktiva sessionen hos Supabase.
export default function LoggaUtKnapp({ className = "link-btn", vidKlick }) {
  const router = useRouter();
  const [pagar, setPagar] = useState(false);
  const [fel, setFel] = useState("");

  async function loggaUt() {
    // Används av mobilmenyn, som annars blir stående öppen över
    // inloggningssidan man skickas till.
    vidKlick?.();
    setPagar(true);
    setFel("");

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      // Misslyckas utloggningen sitter sessionen kvar. Då ska det synas —
      // ett tyst misslyckande här är värre än de flesta, eftersom man tror
      // att man loggat ut.
      setPagar(false);
      setFel("Kunde inte logga ut. Försök igen.");
      return;
    }

    router.push("/logga-in");
    // Utan refresh kan serverkomponenter ligga kvar i routerns cache och
    // fortfarande visa den utloggade sessionens innehåll.
    router.refresh();
  }

  return (
    <span className="utloggning">
      <button type="button" className={className} onClick={loggaUt} disabled={pagar}>
        {pagar ? "Loggar ut…" : "Logga ut"}
      </button>
      {fel && <span className="utloggning-fel">{fel}</span>}
    </span>
  );
}
