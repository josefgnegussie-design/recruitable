"use client";

import { useState } from "react";

const SKALVAL = [
  { varde: "fusion", etikett: "Fusion registrerad hos Bolagsverket" },
  { varde: "koncernbeslut", etikett: "Koncernen ska uppträda under ett namn" },
  { varde: "avregistrerad", etikett: "Bolaget är avregistrerat" },
];

// Panelen där ett bolag begär att två kort i registret ska bli ett.
//
// Bakgrund: registret ger varje juridisk person ett eget kort, vilket är rätt i
// normalfallet — två bolag i samma koncern har egna organisationsnummer, egna
// kontor och egna årsredovisningar. Men efter en fusion, en avregistrering eller
// ett koncernbeslut om att uppträda under ett namn blir två kort fel, och fram
// tills nu fanns det ingen väg att ens fråga.
//
// Ingenting verkställs härifrån. Vi kan inte kontrollera ägarförhållanden
// maskinellt — Bolagsverkets öppna datamängder innehåller dem inte — så det som
// skickas är en begäran som en människa avgör. Utan den spärren vore det här en
// knapp för att radera en konkurrent ur registret.
export default function Sammanslagning({ arenden: initiala = [], duArAgare = false, bolagsnamn = "" }) {
  const [arenden, setArenden] = useState(initiala);
  const [viUpphor, setViUpphor] = useState(false);
  const [motpart, setMotpart] = useState(null);
  const [fraga, setFraga] = useState("");
  const [traffar, setTraffar] = useState(null);
  const [soker, setSoker] = useState(false);
  const [skal, setSkal] = useState("koncernbeslut");
  const [datum, setDatum] = useState("");
  const [meddelande, setMeddelande] = useState("");
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState("");
  const [besked, setBesked] = useState("");

  const oppet = arenden.find((a) => a.status === "pending");

  async function sok(varde) {
    setFraga(varde);
    if (varde.trim().length < 2) {
      setTraffar(null);
      return;
    }
    setSoker(true);
    try {
      const res = await fetch(`/api/mina-sidor/bolag-sok?q=${encodeURIComponent(varde)}`);
      const body = await res.json();
      setTraffar(res.ok ? body.traffar || [] : []);
    } catch {
      setTraffar([]);
    } finally {
      setSoker(false);
    }
  }

  async function skicka(e) {
    e.preventDefault();
    setFel("");
    setBesked("");

    if (!motpart) {
      setFel("Välj vilket bolag det gäller.");
      return;
    }

    setArbetar(true);
    const res = await fetch("/api/mina-sidor/sammanslagning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        motpartId: motpart.id,
        viUpphor,
        skal,
        datum: datum || null,
        meddelande: meddelande.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setArbetar(false);

    if (!res.ok) {
      setFel(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setArenden(body.arenden ?? []);
    setMotpart(null);
    setFraga("");
    setTraffar(null);
    setMeddelande("");
    setDatum("");
    setBesked("Begäran är skickad. Vi granskar den och hör av oss med besked.");
  }

  async function draTillbaka(arende) {
    setArbetar(true);
    setFel("");
    setBesked("");

    const res = await fetch("/api/mina-sidor/sammanslagning", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arendeId: arende.id }),
    });
    const body = await res.json().catch(() => ({}));
    setArbetar(false);

    if (!res.ok) {
      setFel(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setArenden(body.arenden ?? []);
    setBesked("Begäran är tillbakadragen.");
  }

  return (
    <div className="auth-panel" style={{ marginTop: 20 }}>
      <div className="filter-title">Sammanslagning av bolag</div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
        Har bolaget gått samman med ett annat, upphört, eller ska koncernen synas under ett namn? Då kan
        två kort i registret bli ett. Det bolag som upphör försvinner ur sökningen, och dess adress leder
        vidare till det som lever — orter, kontor och inloggningar följer med, så ingen ort försvinner ur
        sökningen och ingen blir utan konto.
      </p>

      {arenden.length > 0 && (
        <ul className="admin-lista" style={{ marginBottom: 16 }}>
          {arenden.map((a) => (
            <li key={a.id}>
              <span className="admin-epost">
                {a.upphorande.name} → {a.overlevande.name}
                <span className={`ansokan-flagga ${a.status === "approved" ? "ok" : "varning"}`}>
                  {a.statusText}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--color-muted)" }}>
                  {a.skalText}
                  {a.beslutsnot ? ` · ${a.beslutsnot}` : ""}
                </span>
              </span>
              {a.status === "pending" && duArAgare && (
                <span className="admin-knappar">
                  <button
                    type="button"
                    className="kontor-ta-bort"
                    disabled={arbetar}
                    onClick={() => draTillbaka(a)}
                  >
                    Dra tillbaka
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!duArAgare ? (
        <p className="note">Bara kontots ägare kan begära en sammanslagning.</p>
      ) : oppet ? (
        <p className="note">
          Ni har redan ett ärende som väntar på granskning. Vi hör av oss med besked så snart det är
          avgjort.
        </p>
      ) : (
        <form onSubmit={skicka}>
          <div className="field">
            <label htmlFor="riktning">Vad ska hända?</label>
            <select
              id="riktning"
              value={viUpphor ? "vi" : "de"}
              onChange={(e) => setViUpphor(e.target.value === "vi")}
            >
              <option value="de">Ett annat bolag ska gå upp i {bolagsnamn || "vårt bolag"}</option>
              <option value="vi">{bolagsnamn || "Vårt bolag"} ska gå upp i ett annat bolag</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="motpart-sok">
              {viUpphor ? "Bolaget som lever vidare" : "Bolaget som ska upphöra"}
            </label>
            {motpart ? (
              <p style={{ fontSize: 13.5, margin: "0 0 8px" }}>
                <strong>{motpart.name}</strong> ({motpart.city}
                {motpart.org_number ? `, ${motpart.org_number}` : ""})
                {" · "}
                <button type="button" className="link-btn" onClick={() => setMotpart(null)}>
                  Ångra valet
                </button>
              </p>
            ) : (
              <div className="koppla-sok">
                <input
                  id="motpart-sok"
                  type="text"
                  value={fraga}
                  placeholder="Namn eller organisationsnummer"
                  onChange={(e) => sok(e.target.value)}
                />
                {soker && <p className="note">Söker…</p>}
                {traffar?.length === 0 && !soker && <p className="note">Inga träffar i registret.</p>}
                {traffar?.length > 0 && (
                  <ul className="koppla-traffar">
                    {traffar.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setMotpart(b);
                            setTraffar(null);
                          }}
                        >
                          <span className="lookup-name">{b.name}</span>
                          <span className="lookup-meta">
                            {[b.city, b.org_number || "utan org.nummer"].filter(Boolean).join(" · ")}
                            {b.merged_into ? " · redan sammanslaget" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="skal">Skäl</label>
            <select id="skal" value={skal} onChange={(e) => setSkal(e.target.value)}>
              {SKALVAL.map((s) => (
                <option key={s.varde} value={s.varde}>
                  {s.etikett}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="datum">Datum (frivilligt)</label>
            <input id="datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            <p className="hint">Fusionsdatum eller avregistreringsdatum, om det finns ett.</p>
          </div>

          <div className="field">
            <label htmlFor="meddelande">Meddelande till oss (frivilligt)</label>
            <textarea
              id="meddelande"
              rows={3}
              maxLength={2000}
              value={meddelande}
              onChange={(e) => setMeddelande(e.target.value)}
              placeholder="Hur bolagen hör ihop — det gör granskningen snabbare."
            />
            <p className="hint">
              Vi kan inte slå upp ägarförhållanden i något öppet register, så en människa granskar
              begäran innan något ändras. Ligger bolagen på samma webbplats är det oftast nog.
            </p>
          </div>

          <button
            className="qs-btn"
            type="submit"
            disabled={arbetar}
            style={{ width: "auto", padding: "11px 20px" }}
          >
            {arbetar ? "Skickar…" : "Begär sammanslagning"}
          </button>
        </form>
      )}

      {/* Utanför formuläret: en skickad begäran döljer det, och beskedet skulle
          då försvinna i samma ögonblick som det blev sant. */}
      {fel && <p style={{ color: "var(--color-error)", fontSize: 13, marginTop: 12 }}>{fel}</p>}
      {besked && <p style={{ color: "var(--color-success)", fontSize: 13, marginTop: 12 }}>{besked}</p>}
    </div>
  );
}
