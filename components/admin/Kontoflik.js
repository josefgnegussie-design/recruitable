"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Kontofliken på Mina sidor: byt lösenord, se vilka som administrerar bolaget,
// och lämna över ansvaret.
//
// Ägaren svarar för prenumerationen och är den enda som får lägga till eller ta
// bort administratörer. Utan den uppdelningen kunde vilken kontorschef som helst
// säga upp bolagets abonnemang så fort de lagts till.
// Listan kommer färdig från servern. Att hämta den i en effekt hade gett en
// extra rundtur efter renderingen och ett tomt läge att visa under tiden —
// sidan vet redan vilka administratörerna är när den byggs.
export default function Kontoflik({ administratorer: initiala = [], duArAgare: initialtAgare = false }) {
  const [administratorer, setAdministratorer] = useState(initiala);
  const [duArAgare, setDuArAgare] = useState(initialtAgare);
  const [fel, setFel] = useState("");
  const [besked, setBesked] = useState("");
  const [arbetar, setArbetar] = useState(false);

  const [nyEpost, setNyEpost] = useState("");
  const [losenord, setLosenord] = useState("");
  const [losenordIgen, setLosenordIgen] = useState("");
  const [losenordsbesked, setLosenordsbesked] = useState("");
  const [losenordsfel, setLosenordsfel] = useState("");

  async function anropa(url, metod, kropp) {
    setArbetar(true);
    setFel("");
    setBesked("");

    const res = await fetch(url, {
      method: metod,
      headers: { "Content-Type": "application/json" },
      body: kropp ? JSON.stringify(kropp) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    setArbetar(false);

    if (!res.ok) {
      setFel(body.error || "Något gick fel. Försök igen.");
      return false;
    }

    if (body.administratorer) setAdministratorer(body.administratorer);
    if (body.duArAgare !== undefined) setDuArAgare(body.duArAgare);
    return true;
  }

  async function laggTill(e) {
    e.preventDefault();
    if (await anropa("/api/mina-sidor/konto/anvandare", "POST", { epost: nyEpost })) {
      setBesked(`${nyEpost} är nu administratör.`);
      setNyEpost("");
    }
  }

  async function taBort(a) {
    if (await anropa("/api/mina-sidor/konto/anvandare", "DELETE", { adminId: a.id })) {
      setBesked(`${a.epost} har tagits bort.`);
    }
  }

  async function overlat(a) {
    if (await anropa("/api/mina-sidor/konto/overlat", "POST", { adminId: a.id })) {
      setBesked(`${a.epost} är nu ägare. Ni är kvar som administratör.`);
    }
  }

  async function bytLosenord(e) {
    e.preventDefault();
    setLosenordsfel("");
    setLosenordsbesked("");

    if (losenord.length < 8) {
      setLosenordsfel("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (losenord !== losenordIgen) {
      setLosenordsfel("Lösenorden stämmer inte överens.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: losenord });

    if (error) {
      setLosenordsfel(error.message || "Kunde inte byta lösenord.");
      return;
    }

    setLosenord("");
    setLosenordIgen("");
    setLosenordsbesked("Lösenordet är bytt.");
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div className="auth-panel">
        <div className="filter-title">Administratörer</div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
          Ägaren svarar för prenumerationen och är den enda som kan lägga till eller ta bort
          administratörer. Övriga arbetar med profilen och förfrågningarna precis som ägaren.
        </p>

        {administratorer.length === 0 ? (
          <p className="note">Inga administratörer hittades.</p>
        ) : (
          <ul className="admin-lista">
            {administratorer.map((a) => (
              <li key={a.id}>
                <span className="admin-epost">
                  {a.epost || <em>okänd adress</em>}
                  {a.arAgare && <span className="ansokan-flagga ok">ägare</span>}
                </span>
                {duArAgare && !a.arAgare && (
                  <span className="admin-knappar">
                    <button type="button" className="link-btn" disabled={arbetar} onClick={() => overlat(a)}>
                      Gör till ägare
                    </button>
                    <button type="button" className="kontor-ta-bort" disabled={arbetar} onClick={() => taBort(a)}>
                      Ta bort
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {duArAgare ? (
          <form onSubmit={laggTill} style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="ny-admin">Lägg till administratör</label>
              <input
                id="ny-admin"
                type="email"
                value={nyEpost}
                onChange={(e) => setNyEpost(e.target.value)}
                placeholder="kollega@erabolag.se"
                required
              />
              <p className="hint">
                Kollegan måste ha registrerat ett konto först. Vi skickar ingen inbjudan — ni går i
                god för kopplingen genom att lägga till adressen här.
              </p>
            </div>
            <button className="qs-btn" type="submit" disabled={arbetar} style={{ width: "auto", padding: "11px 20px" }}>
              {arbetar ? "Arbetar…" : "Lägg till"}
            </button>
          </form>
        ) : (
          <p className="note" style={{ marginTop: 14 }}>
            Bara ägaren kan lägga till eller ta bort administratörer.
          </p>
        )}

        {fel && <p style={{ color: "var(--color-error)", fontSize: 13, marginTop: 12 }}>{fel}</p>}
        {besked && <p style={{ color: "var(--color-success)", fontSize: 13, marginTop: 12 }}>{besked}</p>}
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Byt lösenord</div>
        <form onSubmit={bytLosenord}>
          <div className="field">
            <label htmlFor="nytt-losenord">Nytt lösenord</label>
            <input
              id="nytt-losenord"
              type="password"
              value={losenord}
              onChange={(e) => setLosenord(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="nytt-losenord-igen">Upprepa lösenordet</label>
            <input
              id="nytt-losenord-igen"
              type="password"
              value={losenordIgen}
              onChange={(e) => setLosenordIgen(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {losenordsfel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{losenordsfel}</p>}
          {losenordsbesked && (
            <p style={{ color: "var(--color-success)", fontSize: 13 }}>{losenordsbesked}</p>
          )}
          <button className="qs-btn" type="submit" style={{ width: "auto", padding: "11px 20px" }}>
            Byt lösenord
          </button>
        </form>
      </div>
    </div>
  );
}
