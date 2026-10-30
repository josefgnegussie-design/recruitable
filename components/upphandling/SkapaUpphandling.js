"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { allRegionCities, kanoniskOrt } from "@/lib/helpers";
import { TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { KRAV_MALL, MAX_KOMPETENSER, MAX_KRAV, MAX_OMRADEN, MAX_ORTER } from "@/lib/upphandling";
import { arGratisadress } from "@/lib/gratisadresser";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import SkrappostPaminnelse from "@/components/SkrappostPaminnelse";

const NIVAER = [
  { varde: "ska", namn: "Ska-krav" },
  { varde: "bor", namn: "Bör-krav" },
  { varde: "inget", namn: "Inget krav" },
];

const TOMT = {
  kopartyp: "privat",
  titel: "",
  kopare: "",
  tjanst: "",
  avtalstid: "",
  volym: "",
  beskrivning: "",
  orter: [],
  kompetenser: [],
  omraden: [],
  nivaer: Object.fromEntries(KRAV_MALL.map((k) => [k.id, k.niva])),
  egnaKrav: [],
  sistaFraga: "",
  sistaIntresse: "",
  besked: "",
  avtalsstart: "",
  synlighet: "efter_intresse",
  epost: "",
  webbplats: "",
  foretag: "",
  ort: "",
  namn: "",
  roll: "",
  telefon: "",
};

function domanUrUrl(url) {
  try {
    const med = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(med).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

// Chips med kryss, samma fält för orter och kompetenser.
function Taggar({ lista, taBort }) {
  if (!lista.length) return null;
  return (
    <div className="upp-chips" style={{ marginTop: 10 }}>
      {lista.map((v) => (
        <button type="button" key={v} className="chip on" aria-label={`Ta bort ${v}`} onClick={() => taBort(v)}>
          {v} ×
        </button>
      ))}
    </div>
  );
}

export default function SkapaUpphandling() {
  const { state: d, patch, restored, clearDraft } = useSessionDraft("upphandling", TOMT);
  const [nyOrt, setNyOrt] = useState("");
  const [nyKompetens, setNyKompetens] = useState("");
  const [nyttKrav, setNyttKrav] = useState("");
  const [ortfel, setOrtfel] = useState("");
  const [fel, setFel] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [lank, setLank] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const vidVerifiering = useCallback((t) => setTurnstileToken(t), []);

  const orter = useMemo(() => allRegionCities(), []);
  const omraden = useMemo(() => Object.keys(YRKESOMRADEN), []);

  function laggTillOrt() {
    const ort = kanoniskOrt(nyOrt);
    if (!ort) return setOrtfel("Välj en svensk kommun ur listan.");
    setOrtfel("");
    setNyOrt("");
    if (!d.orter.includes(ort) && d.orter.length < MAX_ORTER) patch({ orter: [...d.orter, ort] });
  }

  function laggTillKompetens() {
    const k = nyKompetens.trim();
    if (!k) return;
    setNyKompetens("");
    const finns = d.kompetenser.some((x) => x.toLowerCase() === k.toLowerCase());
    if (!finns && d.kompetenser.length < MAX_KOMPETENSER) patch({ kompetenser: [...d.kompetenser, k] });
  }

  function laggTillKrav() {
    const text = nyttKrav.trim();
    if (!text) return;
    setNyttKrav("");
    patch({ egnaKrav: [...d.egnaKrav, { id: `egen-${Date.now()}`, text, niva: "ska", profil: null }] });
  }

  function vaxlaOmrade(o) {
    if (d.omraden.includes(o)) return patch({ omraden: d.omraden.filter((x) => x !== o) });
    if (d.omraden.length < MAX_OMRADEN) patch({ omraden: [...d.omraden, o] });
  }

  function vidEnter(handling) {
    return (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handling();
      }
    };
  }

  const krav = [
    ...KRAV_MALL.filter((k) => d.nivaer[k.id] !== "inget").map((k) => ({ ...k, niva: d.nivaer[k.id] })),
    ...d.egnaKrav,
  ];

  async function skicka(e) {
    e.preventDefault();
    setFel("");

    if (arGratisadress(d.epost.split("@")[1])) {
      return setFel("Använd din jobbadress på företagets egen domän.");
    }
    if (domanUrUrl(d.webbplats.trim()) !== d.epost.trim().split("@")[1]?.toLowerCase()) {
      return setFel("Webbplatsen måste ha samma domän som din e-post.");
    }

    setSkickar(true);
    const res = await fetch("/api/upphandling/skicka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...d,
        krav,
        turnstileToken,
        kontakt: {
          namn: d.namn,
          epost: d.epost,
          webbplats: d.webbplats,
          roll: d.roll,
          foretag: d.foretag,
          ort: d.ort,
          telefon: d.telefon,
        },
      }),
    });
    const svar = await res.json().catch(() => ({}));
    setSkickar(false);

    if (!res.ok) return setFel(svar.error || "Något gick fel. Försök igen.");
    clearDraft();
    setLank(svar.lank);
  }

  if (!restored) return null;

  if (lank) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto 60px", padding: "0 24px", textAlign: "center" }}>
        <div className="auth-panel">
          <h1 className="upp-rubrik">Tack!</h1>
          <p className="upp-brod">
            Upphandlingen är skickad till granskning hos Recruitable. På er egen sida följer ni vilka leverantörer som
            anmäler sig. Länken finns också i bekräftelsemejlet till {d.epost}.
          </p>
          <Link className="qs-btn upp-lank-knapp" href={lank}>Öppna er upphandling</Link>
        </div>
        <SkrappostPaminnelse adress={d.epost} />
      </div>
    );
  }

  const antalKomb = d.orter.length * d.kompetenser.length;
  const klar = !TURNSTILE_SITE_KEY || Boolean(turnstileToken);

  return (
    <div id="view-upphandling">
      <Link className="back-link" href="/upphandling">&larr; Upphandling</Link>
      <div className="upp-sida">
        <header className="upp-huvud">
          <h1 className="hero-title">Lägg ut en upphandling</h1>
          <p className="hero-sub">Börja med det ni vet. Ett fullständigt förfrågningsunderlag behövs inte i det här steget.</p>
        </header>

        <form className="upp-kolumner" onSubmit={skicka}>
          <main>
            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Vem köper?</h2>
              <div className="upp-chips">
                {[["privat", "Privat bolag"], ["offentlig", "Offentlig verksamhet"]].map(([v, namn]) => (
                  <button type="button" key={v} className={`chip${d.kopartyp === v ? " on" : ""}`} aria-pressed={d.kopartyp === v} onClick={() => patch({ kopartyp: v })}>
                    {namn}
                  </button>
                ))}
              </div>
              {d.kopartyp === "offentlig" && (
                <p className="upp-varning">
                  Annonsen blir en marknadsdialog. Den ersätter inte annonsering av upphandlingen i en registrerad annonsdatabas.
                </p>
              )}
              <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
                <label htmlFor="upp-kopare">Beskriv er utan namn</label>
                <input id="upp-kopare" value={d.kopare} maxLength={120} onChange={(e) => patch({ kopare: e.target.value })} placeholder="Industribolag, cirka 1 200 anställda" required />
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Vad ska köpas?</h2>
              <div className="field">
                <label htmlFor="upp-titel">Rubrik</label>
                <input id="upp-titel" value={d.titel} maxLength={120} onChange={(e) => patch({ titel: e.target.value })} placeholder="Ramavtal lager och produktion" required />
              </div>
              <div className="field">
                <label htmlFor="upp-tjanst">Tjänst</label>
                <select id="upp-tjanst" value={d.tjanst} onChange={(e) => patch({ tjanst: e.target.value })} required>
                  <option value="">Välj tjänst</option>
                  {TJANSTER.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-avtal">Avtalstid</label>
                  <input id="upp-avtal" value={d.avtalstid} maxLength={80} onChange={(e) => patch({ avtalstid: e.target.value })} placeholder="2 år + 1 år option" />
                </div>
                <div className="field">
                  <label htmlFor="upp-volym">Ungefärlig volym</label>
                  <input id="upp-volym" value={d.volym} maxLength={120} onChange={(e) => patch({ volym: e.target.value })} placeholder="Cirka 60 konsulter samtidigt" />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="upp-beskrivning">Kort beskrivning</label>
                <textarea id="upp-beskrivning" rows={4} value={d.beskrivning} maxLength={1500} onChange={(e) => patch({ beskrivning: e.target.value })} required />
                <p className="hint">Skriv inte ert bolagsnamn här om ni vill vara anonyma.</p>
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Var och vilka kompetenser?</h2>
              <div className="field">
                <label htmlFor="upp-ny-ort">Orter (högst {MAX_ORTER})</label>
                <div className="upp-rad">
                  <input id="upp-ny-ort" list="upp-orter" value={nyOrt} autoComplete="off" onChange={(e) => setNyOrt(e.target.value)} onKeyDown={vidEnter(laggTillOrt)} />
                  <button type="button" className="btn btn-ghost" onClick={laggTillOrt}>Lägg till</button>
                </div>
                <datalist id="upp-orter">
                  {orter.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
                {ortfel && <p className="field-error">{ortfel}</p>}
                <Taggar lista={d.orter} taBort={(v) => patch({ orter: d.orter.filter((x) => x !== v) })} />
              </div>
              <div className="field">
                <label htmlFor="upp-ny-kompetens">Kompetenser (högst {MAX_KOMPETENSER})</label>
                <div className="upp-rad">
                  <input id="upp-ny-kompetens" value={nyKompetens} maxLength={40} placeholder="Till exempel truckförare" onChange={(e) => setNyKompetens(e.target.value)} onKeyDown={vidEnter(laggTillKompetens)} />
                  <button type="button" className="btn btn-ghost" onClick={laggTillKompetens}>Lägg till</button>
                </div>
                <Taggar lista={d.kompetenser} taBort={(v) => patch({ kompetenser: d.kompetenser.filter((x) => x !== v) })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Yrkesområden (högst {MAX_OMRADEN})</label>
                <p className="hint" style={{ marginTop: 0 }}>Bolag med dessa områden i sin profil får besked om upphandlingen.</p>
                <div className="upp-chips">
                  {omraden.map((o) => (
                    <button type="button" key={o} className={`chip${d.omraden.includes(o) ? " on" : ""}`} aria-pressed={d.omraden.includes(o)} onClick={() => vaxlaOmrade(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Krav</h2>
              <p className="upp-not">Den som inte uppfyller alla ska-krav kan inte anmäla sig.</p>
              {KRAV_MALL.map((k) => (
                <div className="upp-kravrad" key={k.id}>
                  <label htmlFor={`upp-krav-${k.id}`}>{k.text}</label>
                  <select id={`upp-krav-${k.id}`} value={d.nivaer[k.id]} onChange={(e) => patch({ nivaer: { ...d.nivaer, [k.id]: e.target.value } })}>
                    {NIVAER.map((n) => (
                      <option key={n.varde} value={n.varde}>{n.namn}</option>
                    ))}
                  </select>
                </div>
              ))}
              {d.egnaKrav.map((k) => (
                <div className="upp-kravrad" key={k.id}>
                  <span>{k.text}</span>
                  <div className="upp-rad-tat">
                    <select aria-label={`Nivå för ${k.text}`} value={k.niva} onChange={(e) => patch({ egnaKrav: d.egnaKrav.map((x) => (x.id === k.id ? { ...x, niva: e.target.value } : x)) })}>
                      <option value="ska">Ska-krav</option>
                      <option value="bor">Bör-krav</option>
                    </select>
                    <button type="button" className="link-btn" onClick={() => patch({ egnaKrav: d.egnaKrav.filter((x) => x.id !== k.id) })}>Ta bort</button>
                  </div>
                </div>
              ))}
              {krav.length < MAX_KRAV && (
                <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                  <label htmlFor="upp-nytt-krav">Eget krav</label>
                  <div className="upp-rad">
                    <input id="upp-nytt-krav" value={nyttKrav} maxLength={160} onChange={(e) => setNyttKrav(e.target.value)} onKeyDown={vidEnter(laggTillKrav)} />
                    <button type="button" className="btn btn-ghost" onClick={laggTillKrav}>Lägg till</button>
                  </div>
                </div>
              )}
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Tidplan och synlighet</h2>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-d1">Sista dag för frågor</label>
                  <input id="upp-d1" type="date" value={d.sistaFraga} onChange={(e) => patch({ sistaFraga: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-d2">Sista dag att anmäla intresse</label>
                  <input id="upp-d2" type="date" value={d.sistaIntresse} onChange={(e) => patch({ sistaIntresse: e.target.value })} required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-d3">Besked till leverantörer</label>
                  <input id="upp-d3" type="date" value={d.besked} onChange={(e) => patch({ besked: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-d4">Planerad avtalsstart (valfritt)</label>
                  <input id="upp-d4" type="date" value={d.avtalsstart} onChange={(e) => patch({ avtalsstart: e.target.value })} />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>När ska leverantörer se ert namn?</label>
                <div className="upp-chips">
                  {[["efter_intresse", "Efter intresseanmälan"], ["direkt", "Direkt, för alla"]].map(([v, namn]) => (
                    <button type="button" key={v} className={`chip${d.synlighet === v ? " on" : ""}`} aria-pressed={d.synlighet === v} onClick={() => patch({ synlighet: v })}>
                      {namn}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">Era uppgifter</h2>
              <p className="upp-not">E-posten måste ha samma domän som er webbplats. Då vet leverantörerna att upphandlingen är äkta.</p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-epost">E-post (jobb)</label>
                  <input id="upp-epost" type="email" value={d.epost} autoComplete="email" onChange={(e) => patch({ epost: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-webb">Webbplats</label>
                  <input id="upp-webb" value={d.webbplats} placeholder="foretag.se" onChange={(e) => patch({ webbplats: e.target.value })} required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-foretag">Företag</label>
                  <input id="upp-foretag" value={d.foretag} onChange={(e) => patch({ foretag: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-ort">Ort</label>
                  <input id="upp-ort" list="upp-orter" value={d.ort} autoComplete="off" onChange={(e) => patch({ ort: e.target.value })} required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-namn">Namn</label>
                  <input id="upp-namn" value={d.namn} autoComplete="name" onChange={(e) => patch({ namn: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-roll">Din roll</label>
                  <input id="upp-roll" value={d.roll} onChange={(e) => patch({ roll: e.target.value })} required />
                </div>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="upp-telefon">Telefon (valfritt)</label>
                <input id="upp-telefon" type="tel" value={d.telefon} onChange={(e) => patch({ telefon: e.target.value })} />
              </div>
            </section>
          </main>

          <aside>
            <section className="auth-panel upp-klibbig">
              <h2 className="upp-rubrik-liten">Sammanfattning</h2>
              <p className="upp-brod"><strong>{d.titel || "Upphandling utan rubrik"}</strong></p>
              <dl className="upp-tidplan">
                <div><dt>Orter</dt><dd>{d.orter.length}</dd></div>
                <div><dt>Kompetenser</dt><dd>{d.kompetenser.length}</dd></div>
                <div><dt>Kombinationer att täcka</dt><dd>{antalKomb}</dd></div>
                <div><dt>Ska-krav</dt><dd>{krav.filter((k) => k.niva === "ska").length}</dd></div>
                <div><dt>Bör-krav</dt><dd>{krav.filter((k) => k.niva === "bor").length}</dd></div>
              </dl>
              <Turnstile onVerify={vidVerifiering} />
              {fel && <p className="field-error" role="alert">{fel}</p>}
              <button className="qs-btn" type="submit" disabled={skickar || !klar || !d.orter.length || !d.kompetenser.length || !d.omraden.length}>
                {skickar ? "Skickar..." : "Skicka till granskning"}
              </button>
              <p className="upp-not">Recruitable granskar upphandlingen före publicering. Därefter får matchande bolag besked.</p>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}
