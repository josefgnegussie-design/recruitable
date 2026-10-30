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
export default function Kontoflik({
  administratorer: initiala = [],
  inbjudningar: initialaInbjudningar = [],
  duArAgare: initialtAgare = false,
}) {
  const [administratorer, setAdministratorer] = useState(initiala);
  const [inbjudningar, setInbjudningar] = useState(initialaInbjudningar);
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

    // Listan över inbjudningar kan följa med även ett fel — inbjudan kan vara
    // sparad fast mejlet inte gick iväg.
    if (body.inbjudningar) setInbjudningar(body.inbjudningar);

    if (!res.ok) {
      setFel(body.error || "Något gick fel. Försök igen.");
      return false;
    }

    if (body.administratorer) setAdministratorer(body.administratorer);
    if (body.duArAgare !== undefined) setDuArAgare(body.duArAgare);
    return true;
  }

  async function bjudIn(e) {
    e.preventDefault();
    if (await anropa("/api/mina-sidor/konto/inbjudan", "POST", { epost: nyEpost })) {
      setBesked(`Inbjudan skickad till ${nyEpost}.`);
      setNyEpost("");
    }
  }

  async function aterkalla(inbjudan) {
    if (await anropa("/api/mina-sidor/konto/inbjudan", "DELETE", { inbjudanId: inbjudan.id })) {
      setBesked(`Inbjudan till ${inbjudan.epost} är återkallad.`);
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

        {duArAgare && inbjudningar.length > 0 && (
          <>
            <div className="filter-title" style={{ fontSize: 15, margin: "18px 0 8px" }}>Inbjudna</div>
            <ul className="admin-lista">
              {inbjudningar.map((i) => (
                <li key={i.id}>
                  <span className="admin-epost">
                    {i.epost}
                    <span className="ansokan-flagga">väntar</span>
                  </span>
                  <span className="admin-knappar">
                    <button type="button" className="kontor-ta-bort" disabled={arbetar} onClick={() => aterkalla(i)}>
                      Återkalla
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {duArAgare ? (
          <form onSubmit={bjudIn} style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="ny-admin">Bjud in en kollega</label>
              <input
                id="ny-admin"
                type="email"
                value={nyEpost}
                onChange={(e) => setNyEpost(e.target.value)}
                placeholder="kollega@erabolag.se"
                required
              />
              <p className="hint">
                Kollegan får ett mejl med en länk som gäller i en vecka, och kommer direkt in på Mina sidor
                utan granskning. Adressen måste ha bolagets domän.
              </p>
            </div>
            <button className="qs-btn" type="submit" disabled={arbetar} style={{ width: "auto", padding: "11px 20px" }}>
              {arbetar ? "Arbetar…" : "Skicka inbjudan"}
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
