"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { allRegionCities, kanoniskOrt } from "@/lib/helpers";
import { TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { MAX_KOMPETENSER, MAX_OMRADEN, MAX_ORTER } from "@/lib/upphandling";
import { FORVALDA_BOLAG, KRAV_VAL, MAX_BESKRIVNING } from "@/lib/upphandlingInbjudan";
import { arGratisadress } from "@/lib/gratisadresser";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import SkrappostPaminnelse from "@/components/SkrappostPaminnelse";
import RelevantaBolag from "@/components/upphandling/RelevantaBolag";

// Köparen beskriver behovet, ser direkt vilka bolag som passar, väljer vilka som
// ska bjudas in och skickar. Inbjudan går sedan samma väg som en förfrågan från
// Rekrytera: Recruitable granskar, bolagen accepterar eller tackar nej på Mina
// sidor, och köparens namn och kontaktuppgifter syns för bolaget först vid accept.

const TOMT = {
  tjanst: "",
  omraden: [],
  orter: [],
  kompetenser: [],
  krav: [],
  ovrigaKrav: "",
  // null tills köparen själv kryssat: då gäller de översta i matchningen. Annars
  // hade förvalet behövt skrivas in i utkastet varje gång listan ändrades.
  valda: null,
  titel: "",
  kopare: "",
  avtalstid: "",
  volym: "",
  beskrivning: "",
  svaraSenast: "",
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
  const { state: d, patch, restored, clearDraft } = useSessionDraft("upphandling-inbjudan", TOMT);
  const [nyOrt, setNyOrt] = useState("");
  const [nyKompetens, setNyKompetens] = useState("");
  const [ortfel, setOrtfel] = useState("");
  const [fel, setFel] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [skickad, setSkickad] = useState(null);
  const [matchning, setMatchning] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const vidVerifiering = useCallback((t) => setTurnstileToken(t), []);

  const orter = useMemo(() => allRegionCities(), []);
  const omraden = useMemo(() => Object.keys(YRKESOMRADEN), []);

  // Matchningen gäller bara så länge det finns något att matcha på.
  const traffar = d.omraden.length && d.orter.length ? matchning : null;
  const listade = useMemo(() => traffar?.bolag ?? [], [traffar]);

  // De valda, alltid bland bolagen som listas just nu. Ett bolag som föll bort
  // när köparen ändrade orter ska inte få en inbjudan de inte längre ser.
  const valda = useMemo(() => {
    const ids = new Set(listade.map((b) => b.id));
    const bas = d.valda ?? listade.slice(0, FORVALDA_BOLAG).map((b) => b.id);
    return new Set(bas.filter((id) => ids.has(id)));
  }, [d.valda, listade]);

  function vaxlaBolag(id) {
    const nya = new Set(valda);
    if (nya.has(id)) nya.delete(id);
    else nya.add(id);
    patch({ valda: [...nya] });
  }

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

  function vaxlaOmrade(o) {
    if (d.omraden.includes(o)) return patch({ omraden: d.omraden.filter((x) => x !== o) });
    if (d.omraden.length < MAX_OMRADEN) patch({ omraden: [...d.omraden, o] });
  }

  function vaxlaKrav(id) {
    patch({ krav: d.krav.includes(id) ? d.krav.filter((x) => x !== id) : [...d.krav, id] });
  }

  function vidEnter(handling) {
    return (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handling();
      }
    };
  }

  async function skicka(e) {
    e.preventDefault();
    setFel("");

    if (!valda.size) return setFel("Välj minst ett bolag att bjuda in.");
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
        tjanst: d.tjanst,
        omraden: d.omraden,
        orter: d.orter,
        kompetenser: d.kompetenser,
        krav: d.krav,
        ovrigaKrav: d.ovrigaKrav,
        titel: d.titel,
        kopare: d.kopare,
        avtalstid: d.avtalstid,
        volym: d.volym,
        beskrivning: d.beskrivning,
        svaraSenast: d.svaraSenast,
        companyIds: [...valda],
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
    setSkickad({ antal: svar.count, uppfoljning: svar.uppfoljning, epost: d.epost });
  }

  if (!restored) return null;

  if (skickad) {
    return (
      <div style={{ maxWidth: 520, margin: "48px auto 60px", padding: "0 24px", textAlign: "center" }}>
        <div className="auth-panel">
          <h1 className="upp-rubrik">Tack!</h1>
          <p className="upp-brod">
            Inbjudan till {skickad.antal} bolag granskas nu av Recruitable. När den är godkänd får bolagen den och tar
            ställning till om de vill gå vidare. Era kontaktuppgifter visas bara för dem som tackar ja.
          </p>
          {skickad.uppfoljning && (
            <Link className="qs-btn upp-lank-knapp" href={skickad.uppfoljning}>Följ svaren</Link>
          )}
          <p className="upp-not">Länken finns också i bekräftelsemejlet till {skickad.epost}.</p>
        </div>
        <SkrappostPaminnelse adress={skickad.epost} />
      </div>
    );
  }

  const klar = !TURNSTILE_SITE_KEY || Boolean(turnstileToken);
  const kravRelevanta = KRAV_VAL.filter((k) => k.profil && d.krav.includes(k.id)).map((k) => k.id);

  return (
    <div id="view-upphandling">
      <Link className="back-link" href="/upphandling">&larr; Upphandling</Link>
      <div className="upp-sida">
        <header className="upp-huvud">
          <h1 className="hero-title">Hitta bolag för er upphandling</h1>
          <p className="hero-sub">
            Beskriv vad ni behöver och var, så ser ni direkt vilka bemannings- och rekryteringsbolag som kan leverera.
            Välj de som verkar intressanta och skicka en inbjudan. Bolagen tar ställning till den precis som till en
            förfrågan.
          </p>
        </header>

        <form className="upp-kolumner" onSubmit={skicka}>
          <main>
            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">1. Vad behöver ni?</h2>
              <div className="field">
                <label htmlFor="upp-tjanst">Tjänst</label>
                <select id="upp-tjanst" value={d.tjanst} onChange={(e) => patch({ tjanst: e.target.value })} required>
                  <option value="">Välj tjänst</option>
                  {TJANSTER.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Bransch och yrkesområden (högst {MAX_OMRADEN})</label>
                <div className="upp-chips">
                  {omraden.map((o) => (
                    <button type="button" key={o} className={`chip${d.omraden.includes(o) ? " on" : ""}`} aria-pressed={d.omraden.includes(o)} onClick={() => vaxlaOmrade(o)}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
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
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="upp-ny-kompetens">Kompetenser (valfritt, högst {MAX_KOMPETENSER})</label>
                <div className="upp-rad">
                  <input id="upp-ny-kompetens" value={nyKompetens} maxLength={40} placeholder="Till exempel truckförare" onChange={(e) => setNyKompetens(e.target.value)} onKeyDown={vidEnter(laggTillKompetens)} />
                  <button type="button" className="btn btn-ghost" onClick={laggTillKompetens}>Lägg till</button>
                </div>
                <Taggar lista={d.kompetenser} taBort={(v) => patch({ kompetenser: d.kompetenser.filter((x) => x !== v) })} />
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">2. Krav</h2>
              <p className="upp-not" style={{ marginTop: 0 }}>
                Det som går att läsa i bolagens profiler visas vid varje bolag nedan. Alla krav står i inbjudan.
              </p>
              {KRAV_VAL.map((k) => (
                <label className="upp-kravrad upp-kryssrad" key={k.id}>
                  <input type="checkbox" checked={d.krav.includes(k.id)} onChange={() => vaxlaKrav(k.id)} />
                  <span>{k.text}</span>
                </label>
              ))}
              <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                <label htmlFor="upp-ovriga-krav">Övriga krav (valfritt)</label>
                <input id="upp-ovriga-krav" value={d.ovrigaKrav} maxLength={300} onChange={(e) => patch({ ovrigaKrav: e.target.value })} placeholder="Till exempel B-körkort eller säkerhetsprövning" />
              </div>
            </section>

            <RelevantaBolag
              tjanst={d.tjanst}
              omraden={d.omraden}
              orter={d.orter}
              krav={kravRelevanta}
              vidResultat={setMatchning}
              valda={valda}
              vaxla={vaxlaBolag}
              valjAlla={() => patch({ valda: listade.map((b) => b.id) })}
              valjInga={() => patch({ valda: [] })}
            />

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">4. Om upphandlingen</h2>
              <div className="field">
                <label htmlFor="upp-titel">Rubrik</label>
                <input id="upp-titel" value={d.titel} maxLength={80} onChange={(e) => patch({ titel: e.target.value })} placeholder="Ramavtal lager och produktion" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-avtal">Avtalstid (valfritt)</label>
                  <input id="upp-avtal" value={d.avtalstid} maxLength={80} onChange={(e) => patch({ avtalstid: e.target.value })} placeholder="2 år + 1 år option" />
                </div>
                <div className="field">
                  <label htmlFor="upp-volym">Ungefärlig volym (valfritt)</label>
                  <input id="upp-volym" value={d.volym} maxLength={120} onChange={(e) => patch({ volym: e.target.value })} placeholder="Cirka 60 konsulter samtidigt" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="upp-beskrivning">Beskrivning</label>
                <textarea id="upp-beskrivning" rows={5} value={d.beskrivning} maxLength={MAX_BESKRIVNING} onChange={(e) => patch({ beskrivning: e.target.value })} required />
                <p className="hint">Visas för bolagen innan de tagit ställning. Ert företagsnamn tar vi från fältet nedan.</p>
              </div>
              <div className="field" style={{ marginBottom: 0, maxWidth: 260 }}>
                <label htmlFor="upp-svar">Svar önskas senast (valfritt)</label>
                <input id="upp-svar" type="date" value={d.svaraSenast} onChange={(e) => patch({ svaraSenast: e.target.value })} />
              </div>
            </section>

            <section className="auth-panel">
              <h2 className="upp-rubrik-liten">5. Era uppgifter</h2>
              {/* Namnet är ett av de starkaste skälen för ett bolag att tacka ja,
                  och just därför syns det först vid accept. Det är där
                  Recruitable förmedlar affären; stod namnet i inbjudan kunde
                  bolaget gå direkt till köparen. Se mapInquiryRow i
                  lib/inquiries.js. */}
              <p className="upp-not" style={{ marginTop: 0 }}>
                Företagsnamn och kontaktuppgifter visas för ett bolag först när det har tackat ja. Innan dess ser bolaget
                beskrivningen av er verksamhet, ert förnamn och er roll.
              </p>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="upp-foretag">Företag</label>
                  <input id="upp-foretag" value={d.foretag} onChange={(e) => patch({ foretag: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-kopare">Beskriv er verksamhet</label>
                  <input id="upp-kopare" value={d.kopare} maxLength={120} onChange={(e) => patch({ kopare: e.target.value })} placeholder="Industribolag, cirka 1 200 anställda" required />
                </div>
              </div>
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
                  <label htmlFor="upp-namn">Namn</label>
                  <input id="upp-namn" value={d.namn} autoComplete="name" onChange={(e) => patch({ namn: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-roll">Din roll</label>
                  <input id="upp-roll" value={d.roll} onChange={(e) => patch({ roll: e.target.value })} required />
                </div>
              </div>
              <div className="field-row" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label htmlFor="upp-ort">Ort</label>
                  <input id="upp-ort" list="upp-orter" value={d.ort} autoComplete="off" onChange={(e) => patch({ ort: e.target.value })} required />
                </div>
                <div className="field">
                  <label htmlFor="upp-telefon">Telefon (valfritt)</label>
                  <input id="upp-telefon" type="tel" value={d.telefon} onChange={(e) => patch({ telefon: e.target.value })} />
                </div>
              </div>
            </section>
          </main>

          <aside>
            <section className="auth-panel upp-klibbig">
              <h2 className="upp-rubrik-liten">Sammanfattning</h2>
              <p className="upp-brod"><strong>{d.titel || "Upphandling utan rubrik"}</strong></p>
              <dl className="upp-tidplan">
                <div><dt>Relevanta bolag</dt><dd>{traffar ? traffar.totalt : "–"}</dd></div>
                <div><dt>Varav aktiva på Recruitable</dt><dd>{traffar ? traffar.aktiva : "–"}</dd></div>
                <div><dt>Valda att bjuda in</dt><dd>{valda.size}</dd></div>
                <div><dt>Orter</dt><dd>{d.orter.length}</dd></div>
                <div><dt>Krav</dt><dd>{d.krav.length + (d.ovrigaKrav.trim() ? 1 : 0)}</dd></div>
              </dl>
              <Turnstile onVerify={vidVerifiering} />
              {fel && <p className="field-error" role="alert">{fel}</p>}
              <button className="qs-btn" type="submit" disabled={skickar || !klar || !valda.size}>
                {skickar ? "Skickar..." : valda.size ? `Skicka inbjudan till ${valda.size} bolag` : "Välj bolag att bjuda in"}
              </button>
              <p className="upp-not">
                Recruitable granskar inbjudan innan bolagen får den. Ni följer deras svar på en egen sida, utan konto.
              </p>
            </section>
          </aside>
        </form>
      </div>
    </div>
  );
}
