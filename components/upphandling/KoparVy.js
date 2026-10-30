"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { byggTackning, datumText, tackningsSiffror } from "@/lib/upphandling";

function csvCell(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

// Listan som fil, för den som vill ta beslutet utanför sajten. En ledande
// BOM gör att Excel läser å, ä och ö rätt.
function exporteraCsv(u, anmalningar) {
  const rubriker = ["Bolag", "E-post", "Kortlista", "Täcker", "Kapacitet", "Referens", "Samarbete", "Presentation"];
  const rader = anmalningar.map((a) => [
    a.namn,
    a.epost,
    a.kortlista ? "Ja" : "Nej",
    a.tackning.map((t) => `${t.ort}: ${t.kompetens}`).join("; "),
    a.kapacitet,
    a.referens,
    a.samarbete ? "Ja" : "Nej",
    a.meddelande,
  ]);
  const csv = [rubriker, ...rader].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${u.title}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function rutklass(antal) {
  if (antal === 0) return "lucka";
  return antal === 1 ? "en" : "flera";
}

function grupperaTackning(tackning) {
  const orter = new Map();
  for (const t of tackning) orter.set(t.ort, [...(orter.get(t.ort) || []), t.kompetens]);
  return [...orter].map(([ort, k]) => `${ort}: ${k.join(", ")}`).join(". ");
}

function FragaRad({ f, token, vidSvar }) {
  const [text, setText] = useState(f.svar || "");
  const [fel, setFel] = useState("");
  const [sparar, setSparar] = useState(false);

  async function spara(e) {
    e.preventDefault();
    setSparar(true);
    setFel("");
    const res = await fetch("/api/upphandling/hantera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, atgard: "svara", fragaId: f.id, svar: text }),
    });
    const svar = await res.json().catch(() => ({}));
    setSparar(false);
    if (!res.ok) return setFel(svar.error || "Kunde inte spara.");
    vidSvar(f.id, text.trim());
  }

  return (
    <form className="upp-fraga" onSubmit={spara}>
      <strong>{f.fraga}</strong>
      <div className="field" style={{ margin: "8px 0" }}>
        <label htmlFor={`svar-${f.id}`}>Ert svar, visas för alla leverantörer</label>
        <textarea id={`svar-${f.id}`} rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} required />
      </div>
      {fel && <p className="field-error">{fel}</p>}
      <button className="btn btn-ghost" style={{ flex: "none" }} type="submit" disabled={sparar}>
        {sparar ? "Sparar..." : f.svar ? "Ändra svaret" : "Publicera svaret"}
      </button>
    </form>
  );
}

export default function KoparVy({ u, token }) {
  const [anmalningar, setAnmalningar] = useState(u.anmalningar);
  const [fragor, setFragor] = useState(u.fragor);
  const [vald, setVald] = useState(null);
  const [avslutad, setAvslutad] = useState(Boolean(u.closed_at));
  const [fel, setFel] = useState("");
  const [bekrafta, setBekrafta] = useState(false);
  const [arbetar, setArbetar] = useState(false);

  const tackning = useMemo(() => byggTackning(u.cities, u.competences, anmalningar), [u, anmalningar]);
  const siffror = useMemo(() => tackningsSiffror(tackning), [tackning]);
  const kortlista = anmalningar.filter((a) => a.kortlista).length;

  const synliga = vald
    ? anmalningar.filter((a) => a.tackning.some((t) => t.ort === vald.ort && t.kompetens === vald.kompetens))
    : anmalningar;

  async function anropa(data) {
    setFel("");
    const res = await fetch("/api/upphandling/hantera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...data }),
    });
    if (res.ok) return true;
    const svar = await res.json().catch(() => ({}));
    setFel(svar.error || "Något gick fel. Försök igen.");
    return false;
  }

  async function vaxlaKortlista(a) {
    const pa = !a.kortlista;
    if (await anropa({ atgard: "kortlista", intresseId: a.id, pa })) {
      setAnmalningar((l) => l.map((x) => (x.id === a.id ? { ...x, kortlista: pa } : x)));
    }
  }

  async function avsluta() {
    setArbetar(true);
    const ok = await anropa({ atgard: "avsluta" });
    setArbetar(false);
    setBekrafta(false);
    if (ok) setAvslutad(true);
  }

  if (u.moderation_status !== "approved") {
    const nekad = u.moderation_status === "rejected";
    return (
      <div className="upp-sida">
        <header className="upp-huvud">
          <div className="eyebrow">Er upphandling</div>
          <h1 className="hero-title">{u.title}</h1>
          <p className="hero-sub">
            {nekad
              ? "Recruitable godkände inte upphandlingen, så den publicerades inte. Hör av er till info@recruitable.se om ni undrar varför."
              : "Upphandlingen granskas av Recruitable. När den är godkänd publiceras den och matchande bolag får besked."}
          </p>
        </header>
      </div>
    );
  }

  return (
    <div id="view-upphandling">
      <div className="upp-sida">
        <header className="upp-huvud upp-huvud-rad">
          <div>
            <div className="eyebrow">
              {avslutad ? "Avslutad" : u.oppen ? `Öppen till ${datumText(u.interest_deadline)}` : "Sista dagen har passerat"}
            </div>
            <h1 className="hero-title">{u.title}</h1>
          </div>
          <div className="upp-rad-tat">
            <button type="button" className="btn btn-ghost" style={{ flex: "none" }} disabled={!anmalningar.length} onClick={() => exporteraCsv(u, anmalningar)}>
              Exportera lista
            </button>
            <Link className="btn btn-ghost" style={{ flex: "none" }} href={`/upphandling/${u.id}`}>Se publik sida</Link>
          </div>
        </header>

        {u.fornamn && (
          <p className="upp-brod">
            Hej {u.fornamn}. Länken till den här sidan är personlig. Dela den bara med dem som ska se leverantörernas svar.
          </p>
        )}

        <div className="upp-tal">
          <div><b>{anmalningar.length}</b><span>intresseanmälningar</span></div>
          <div><b>{siffror.tackta} av {siffror.totalt}</b><span>kombinationer täckta</span></div>
          <div><b>{siffror.enLeverantor}</b><span>med bara en leverantör</span></div>
          <div><b>{kortlista}</b><span>på kortlistan</span></div>
        </div>

        <section className="auth-panel">
          <h2 className="upp-rubrik-liten">Täckning</h2>
          <p className="upp-not">Antal leverantörer per ort och kompetens. Klicka på en ruta för att se vilka det är.</p>
          <div className="upp-matris-ram">
            <table className="upp-matris">
              <thead>
                <tr>
                  <th scope="col"><span className="upp-dold">Ort</span></th>
                  {u.competences.map((k) => (
                    <th scope="col" key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tackning.map((rad) => (
                  <tr key={rad.ort}>
                    <th scope="row">{rad.ort}</th>
                    {rad.rutor.map((r) => {
                      const ar = vald?.ort === rad.ort && vald?.kompetens === r.kompetens;
                      return (
                        <td key={r.kompetens}>
                          <button
                            type="button"
                            className={`upp-ruta ${rutklass(r.antal)}${ar ? " vald" : ""}`}
                            aria-pressed={ar}
                            aria-label={`${r.kompetens} i ${rad.ort}: ${r.antal} leverantörer`}
                            onClick={() => setVald(ar ? null : { ort: rad.ort, kompetens: r.kompetens })}
                          >
                            {r.antal === 0 ? "Lucka" : r.antal}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {siffror.luckor.length > 0 && (
            <p className="upp-not">
              {siffror.luckor.length === siffror.totalt
                ? "Inga leverantörer har anmält sig än."
                : `Luckor: ${siffror.luckor.slice(0, 6).map((l) => `${l.kompetens} i ${l.ort}`).join(", ")}${siffror.luckor.length > 6 ? " med flera" : ""}.`}{" "}
              <Link href={`/rekrytera?ort=${encodeURIComponent(siffror.luckor[0].ort)}`}>Sök bolag i {siffror.luckor[0].ort}</Link>
            </p>
          )}
        </section>

        <section>
          <div className="results-bar">
            <h2 className="upp-rubrik">{vald ? `${vald.kompetens} i ${vald.ort}` : "Alla leverantörer"}</h2>
            {vald && <button type="button" className="link-btn" onClick={() => setVald(null)}>Visa alla leverantörer</button>}
          </div>
          {fel && <p className="field-error" role="alert">{fel}</p>}
          {synliga.length === 0 ? (
            <p className="upp-brod">Ingen leverantör har anmält sig här än.</p>
          ) : (
            <div className="grid">
              {synliga.map((a) => (
                <article className={`card upp-kort${a.kortlista ? " vald" : ""}`} key={a.id}>
                  <div className="card-top">
                    <div>
                      <h3 className="card-name">
                        {a.profil ? <Link href={a.profil}>{a.namn}</Link> : a.namn}
                      </h3>
                      {a.medarbetare && <div className="card-city">{a.medarbetare} medarbetare</div>}
                    </div>
                    {!avslutad && (
                      <button type="button" className={`chip${a.kortlista ? " on" : ""}`} aria-pressed={a.kortlista} onClick={() => vaxlaKortlista(a)}>
                        {a.kortlista ? "På kortlistan" : "Lägg på kortlistan"}
                      </button>
                    )}
                  </div>
                  <dl className="upp-fakta">
                    <dt>Täcker</dt>
                    <dd>{grupperaTackning(a.tackning)}</dd>
                    {a.kapacitet && (<><dt>Kapacitet</dt><dd>{a.kapacitet}</dd></>)}
                    {a.referens && (<><dt>Referens</dt><dd>{a.referens}</dd></>)}
                    <dt>Kontakt</dt>
                    <dd><a href={`mailto:${a.epost}`}>{a.epost}</a></dd>
                  </dl>
                  {a.krav.length > 0 && (
                    <ul className="upp-krav kompakt">
                      {a.krav.map((k) => (
                        <li key={k.id}>
                          <span className={`upp-niva ${k.uppfylls ? "ja" : "nej"}`}>{k.uppfylls ? "Ja" : "Nej"}</span>
                          <span>{k.text}{k.uppfylls && k.kalla === "profil" ? " (enligt profilen)" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.meddelande && <p className="card-vision">{a.meddelande}</p>}
                  {a.samarbete && <p className="upp-matchar">Öppen för samarbete som underleverantör</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="auth-panel">
          <h2 className="upp-rubrik-liten">Frågor från leverantörer</h2>
          <p className="upp-not">Frågorna är anonyma. Svaren visas på den publika sidan.</p>
          {fragor.length === 0 && <p className="upp-brod">Inga frågor än.</p>}
          {fragor.map((f) => (
            <FragaRad
              key={f.id}
              f={f}
              token={token}
              vidSvar={(id, svar) => setFragor((l) => l.map((x) => (x.id === id ? { ...x, svar } : x)))}
            />
          ))}
        </section>

        {avslutad ? (
          <section className="auth-panel">
            <h2 className="upp-rubrik-liten">Upphandlingen är avslutad</h2>
            <p className="upp-brod">Leverantörerna har fått besked. De på kortlistan har fått era kontaktuppgifter.</p>
          </section>
        ) : (
          <section className="auth-panel">
            <h2 className="upp-rubrik-liten">Avsluta och ge besked</h2>
            <p className="upp-brod">
              De {kortlista} på kortlistan får era kontaktuppgifter och besked om att ni vill gå vidare. Övriga{" "}
              {anmalningar.length - kortlista} får ett tack. Det går inte att ångra.
            </p>
            {bekrafta ? (
              <div className="upp-rad-tat">
                <button type="button" className="btn btn-primary" style={{ flex: "none" }} disabled={arbetar} onClick={avsluta}>
                  {arbetar ? "Skickar..." : "Ja, avsluta och skicka besked"}
                </button>
                <button type="button" className="btn btn-ghost" style={{ flex: "none" }} disabled={arbetar} onClick={() => setBekrafta(false)}>
                  Avbryt
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" style={{ flex: "none" }} onClick={() => setBekrafta(true)}>
                Avsluta upphandlingen
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
