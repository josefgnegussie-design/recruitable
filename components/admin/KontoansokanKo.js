"use client";

import { useState } from "react";

// Granskningskön för kontoansökningar. Matchar ansökans org.nummer mot registret
// så att det vanliga fallet blir ett klick — bolaget finns oftast redan bland de
// importerade. Saknas det går det att söka fram, eller skapa bolaget ur ansökan.
export default function KontoansokanKo({ ansokningar }) {
  const [kvar, setKvar] = useState(ansokningar);
  const [arbetar, setArbetar] = useState(null);
  const [fel, setFel] = useState("");

  // Manuellt valt bolag per ansökan, för när matchningen på organisationsnummer
  // inte gav något. Tusentals importerade bolag saknar numret, och utan den här
  // vägen skapar ett godkännande ett dubblettbolag bredvid den profil som redan
  // finns — med vision, beskrivning och orter — som då blir kvar oövertagen.
  const [valt, setValt] = useState({});
  const [traffar, setTraffar] = useState({});
  const [soker, setSoker] = useState(null);

  async function sok(ansokanId, fraga) {
    if (fraga.trim().length < 2) {
      setTraffar((t) => ({ ...t, [ansokanId]: null }));
      return;
    }
    setSoker(ansokanId);
    try {
      const res = await fetch(`/api/admin/bolag-sok?q=${encodeURIComponent(fraga)}`);
      const body = await res.json();
      setTraffar((t) => ({ ...t, [ansokanId]: res.ok ? body.traffar || [] : [] }));
    } catch {
      setTraffar((t) => ({ ...t, [ansokanId]: [] }));
    } finally {
      setSoker(null);
    }
  }

  // Inget beslut verkställs direkt. Ett godkännande ger någon kontrollen över en
  // bolagsprofil, "skapa bolaget" lägger dessutom in en ny rad i registret, och
  // ett avslag raderar ansökan — inget av det går att ångra med en knapp.
  const [bekraftar, setBekraftar] = useState(null);
  const [liknande, setLiknande] = useState(null);

  async function oppnaBekraftelse(ansokan, beslut, bolag) {
    setBekraftar({ ansokan, beslut, bolag: bolag ?? null });
    setLiknande(null);
    setFel("");

    // Ska ett nytt bolag skapas är dubbletten den verkliga risken. Registret
    // slås upp på namnet, så granskaren ser om det redan finns något som liknar
    // innan raden läggs till.
    if (beslut === "godkann" && !bolag) {
      try {
        const res = await fetch(
          `/api/admin/bolag-sok?q=${encodeURIComponent(ansokan.claimed_company_name || "")}`
        );
        const body = await res.json();
        // "misslyckades" och inte en tom lista: ett fel som visas som "inget
        // liknande bolag finns" vore osant och skulle uppmuntra just den
        // dubblett kontrollen finns för att förhindra.
        setLiknande(res.ok ? body.traffar || [] : "misslyckades");
      } catch {
        setLiknande("misslyckades");
      }
    }
  }

  async function besluta() {
    const { ansokan, beslut, bolag } = bekraftar;
    setArbetar(ansokan.id);
    setFel("");

    const res = await fetch("/api/admin/kontoansokan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ansokanId: ansokan.id, beslut, companyId: bolag?.id ?? null }),
    });

    setArbetar(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFel(body.error || "Något gick fel. Försök igen.");
      setBekraftar(null);
      return;
    }

    setBekraftar(null);
    setKvar((prev) => prev.filter((a) => a.id !== ansokan.id));
  }

  if (!kvar.length) {
    return <div className="auth-panel"><p style={{ margin: 0 }}>Inga ansökningar väntar på granskning.</p></div>;
  }

  return (
    <div>
      {fel && <p style={{ color: "#c0392b", fontSize: 13 }}>{fel}</p>}

      {kvar.map((a) => (
        <div className="auth-panel" key={a.id} style={{ marginBottom: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{a.claimed_company_name}</h3>
          <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 14px" }}>
            {a.claimed_org_number} · {a.claimed_address}
            {a.created_at ? ` · ansökt ${new Date(a.created_at).toLocaleDateString("sv-SE")}` : ""}
          </p>

          {/* Identiteten först. Ett godkännande ger den här adressen kontrollen
              över bolagets profil, så granskaren ska kunna ställa mejladress,
              bolagsnamn och webbplatsdomän mot varandra innan beslutet — inte
              lita på att kontrollen gjordes vid registreringen. */}
          <div className="side-fact">
            <span className="k">Ansökt av</span>
            <span className="v">
              {a.epost || <em style={{ color: "var(--color-error)" }}>kontot hittades inte</em>}
              {a.epost && !a.epostBekraftad && (
                <span className="ansokan-flagga varning">adressen inte bekräftad</span>
              )}
            </span>
          </div>
          <div className="side-fact">
            <span className="k">Webbplats</span>
            <span className="v">
              {a.claimed_website}
              <span className={`ansokan-flagga ${a.domanMatchar ? "ok" : "varning"}`}>
                {a.domanMatchar ? "domänen matchar mejladressen" : "domänen matchar INTE mejladressen"}
              </span>
            </span>
          </div>
          <div className="side-fact"><span className="k">Yrkesområden</span><span className="v">{a.claimed_focus_areas?.join(", ") || "—"}</span></div>
          <div className="side-fact"><span className="k">Tjänster</span><span className="v">{a.claimed_services?.join(", ") || "—"}</span></div>

          <div style={{ marginTop: 16 }}>
            {(() => {
              const bolag = valt[a.id] ?? a.foreslaget;
              return (
                <>
                  {bolag ? (
                    <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
                      {valt[a.id] ? "Valt bolag: " : "Matchar "}
                      <strong>{bolag.name}</strong> ({bolag.city}, id {bolag.id})
                      {valt[a.id] ? "" : " på organisationsnummer"}.
                      {valt[a.id] && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setValt((v) => ({ ...v, [a.id]: undefined }))}
                          >
                            Ångra valet
                          </button>
                        </>
                      )}
                    </p>
                  ) : (
                    <p style={{ fontSize: 13.5, margin: "0 0 12px", color: "var(--color-muted)" }}>
                      Inget bolag i registret har det här organisationsnumret. Godkänner du utan att
                      välja nedan skapas bolaget ur ansökans uppgifter.
                    </p>
                  )}

                  {/* Sökningen står kvar även när org.numret matchat — matchningen
                      kan peka på fel rad, och då ska den gå att styra om. */}
                  <details className="koppla-sok" open={!bolag}>
                    <summary>Bolaget finns redan — sök och koppla dit</summary>
                    <input
                      type="text"
                      placeholder="Namn eller organisationsnummer"
                      onChange={(e) => sok(a.id, e.target.value)}
                      aria-label="Sök bolag i registret"
                    />
                    {soker === a.id && <p className="note">Söker…</p>}
                    {traffar[a.id]?.length === 0 && soker !== a.id && (
                      <p className="note">Inga träffar i registret.</p>
                    )}
                    {traffar[a.id]?.length > 0 && (
                      <ul className="koppla-traffar">
                        {traffar[a.id].map((b) => (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => setValt((v) => ({ ...v, [a.id]: b }))}
                            >
                              <span className="lookup-name">{b.name}</span>
                              <span className="lookup-meta">
                                {[b.city, b.org_number || "utan org.nummer", `id ${b.id}`]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {b.claimed ? " · redan övertaget" : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </>
              );
            })()}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
              <button
                className="qs-btn"
                style={{ width: "auto", padding: "11px 20px" }}
                disabled={arbetar === a.id}
                onClick={() => oppnaBekraftelse(a, "godkann", valt[a.id] ?? a.foreslaget)}
              >
                {arbetar === a.id
                  ? "Arbetar..."
                  : (valt[a.id] ?? a.foreslaget)
                    ? `Godkänn och koppla till ${(valt[a.id] ?? a.foreslaget).name}`
                    : "Godkänn och skapa bolaget"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: "none", padding: "11px 20px" }}
                disabled={arbetar === a.id}
                onClick={() => oppnaBekraftelse(a, "avsla")}
              >
                Avslå
              </button>
            </div>
          </div>
        </div>
      ))}

      {bekraftar && (
        <div
          className="confirm-overlay"
          onClick={() => arbetar === null && setBekraftar(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            {bekraftar.beslut === "avsla" ? (
              <>
                <h3>Avslå ansökan?</h3>
                <p className="sub">
                  Ansökan från <strong>{bekraftar.ansokan.epost}</strong> för{" "}
                  {bekraftar.ansokan.claimed_company_name} tas bort ur kön. Kontot finns kvar men
                  kommer inte in på Mina sidor, och vill de försöka igen får de ansöka på nytt.
                </p>
              </>
            ) : bekraftar.bolag ? (
              <>
                <h3>Koppla till {bekraftar.bolag.name}?</h3>
                <p className="sub">Det här händer när du bekräftar:</p>
                <ul className="confirm-company-list">
                  <li>
                    <strong>{bekraftar.ansokan.epost}</strong> får redigera profilen för{" "}
                    {bekraftar.bolag.name} (id {bekraftar.bolag.id})
                  </li>
                  <li>Profilen markeras som övertagen — &quot;Ta över profilen&quot; försvinner</li>
                  {!bekraftar.bolag.org_number && bekraftar.ansokan.claimed_org_number && (
                    <li>
                      Organisationsnumret {bekraftar.ansokan.claimed_org_number} fylls i på bolaget,
                      som saknar det i dag
                    </li>
                  )}
                  <li>Ett besked om att kontot godkänts skickas till {bekraftar.ansokan.epost}</li>
                </ul>
                {bekraftar.bolag.claimed && (
                  <p className="sub" style={{ color: "var(--color-error)" }}>
                    Obs: bolaget är redan övertaget av någon annan. Kopplar du hit får båda kontona
                    tillgång till samma profil.
                  </p>
                )}
              </>
            ) : (
              <>
                <h3>Skapa ett nytt bolag?</h3>
                <p className="sub">
                  Ingen koppling är vald, så <strong>{bekraftar.ansokan.claimed_company_name}</strong>{" "}
                  läggs till som en ny rad i registret ur ansökans uppgifter.
                </p>
                {liknande === null ? (
                  <p className="note">Söker efter liknande bolag i registret…</p>
                ) : liknande === "misslyckades" ? (
                  <p className="sub" style={{ color: "var(--color-error)" }}>
                    Kunde inte söka efter liknande bolag. Kontrollera i registret för hand innan du
                    skapar ett nytt — annars riskerar du en dubblett.
                  </p>
                ) : liknande.length > 0 ? (
                  <>
                    <p className="sub" style={{ color: "var(--color-error)" }}>
                      Registret innehåller redan {liknande.length} bolag med liknande namn. Är något
                      av dem samma bolag blir det här en dubblett — stäng och koppla dit i stället.
                    </p>
                    <ul className="confirm-company-list">
                      {liknande.slice(0, 5).map((b) => (
                        <li key={b.id}>
                          {b.name} · {b.city} · id {b.id}
                          {b.org_number ? ` · ${b.org_number}` : " · utan org.nummer"}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="note">Inget liknande bolag finns i registret.</p>
                )}
              </>
            )}

            {fel && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{fel}</p>}

            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={arbetar !== null}
                onClick={() => setBekraftar(null)}
              >
                Avbryt
              </button>
              <button className="qs-btn" type="button" disabled={arbetar !== null} onClick={besluta}>
                {arbetar !== null
                  ? "Arbetar..."
                  : bekraftar.beslut === "avsla"
                    ? "Bekräfta avslag"
                    : bekraftar.bolag
                      ? "Bekräfta koppling"
                      : "Bekräfta och skapa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
