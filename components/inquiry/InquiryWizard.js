"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { allRegionCities, regionForCity } from "@/lib/helpers";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Stepper from "@/components/wizard/Stepper";
import SelectableCompanyCard from "./SelectableCompanyCard";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import SkrappostPaminnelse from "@/components/SkrappostPaminnelse";
import { arGratisadress } from "@/lib/gratisadresser";
import { MAX_ANTAL, startAlternativ, tolkaAntal } from "@/lib/forfraganDetaljer";
import ForfraganDetaljer from "./ForfraganDetaljer";

function domainOf(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const EPOST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function domanUrEpost(epost) {
  return String(epost || "").split("@")[1]?.trim().toLowerCase() || "";
}

// Det som står i e-postfältet, granskat när fältet lämnas. Samma regler som
// när man trycker Skicka, men med ett besked som säger vad som är fel.
function epostFel(epost) {
  const adress = String(epost || "").trim();
  if (!adress) return "";
  if (!EPOST_RE.test(adress)) return "Det ser inte ut som en e-postadress.";
  const doman = domanUrEpost(adress);
  if (arGratisadress(doman)) {
    return `Använd din jobbadress på företagets egen domän. Bolagen ser att förfrågan är äkta genom att adressen och er webbplats har samma domän, och det går inte att visa med en ${doman}-adress.`;
  }
  return "";
}

function webbplatsFel(webbplats, epost) {
  const epostDoman = domanUrEpost(epost);
  const webbDoman = domainOf(String(webbplats || "").trim());
  if (!webbplats.trim() || !epostDoman || epostFel(epost)) return "";
  if (!webbDoman || webbDoman !== epostDoman) {
    return `Webbplatsen måste ha samma domän som din e-post (${epostDoman}).`;
  }
  return "";
}

// Det företagsuppslaget söker på: domänen utan toppdomän, "nordic-staffing.se"
// blir "nordic staffing". Ett namn ur registret är bara ett förslag, så en
// gissning som slår fel kostar en rättning, inte en felaktig förfrågan.
function sokordUrDoman(doman) {
  const delar = String(doman || "").split(".");
  return (delar.length > 1 ? delar.slice(0, -1).join(" ") : delar[0]).replace(/[-_]/g, " ").trim();
}

// Domäner skrivs utan å, ä och ö, så "Företaget AB" ska känna igen sig i
// "foretag.se".
function forenkla(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(ab|aktiebolag|hb|kb|publ)\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// Filtret följer med tillbaka till /rekrytera, så att den som vill ändra ort eller
// yrkesområde hittar sina egna svar kvar i formuläret istället för tomma fält.
function filterHref(filters) {
  const params = new URLSearchParams();
  if (filters.beskrivning) params.set("beskrivning", filters.beskrivning);
  if (filters.omrade) params.set("omrade", filters.omrade);
  if (filters.service) params.set("tjanst", filters.service);
  if (filters.ort) params.set("ort", filters.ort);
  const query = params.toString();
  return query ? `/rekrytera?${query}` : "/rekrytera";
}

// Listan kommer rangordnad efter relevans. Att förvälja alla träffar, upp till
// hundra, gjorde det enklare att skicka till för många än till rätt bolag.
const FORVALDA = 10;
// Över så här många valda bolag påminner formuläret om att förfrågan blir
// bredare än den behöver vara. "Välj alla" går fortfarande.
const VARNA_OVER = 15;

function forval(results) {
  return new Set(results.slice(0, FORVALDA).map((c) => c.id));
}

function serializeDraft(draft) {
  // Set går inte att JSON-serialisera.
  return { ...draft, selected: [...draft.selected] };
}

function deserializeDraft(saved) {
  return { ...saved, selected: new Set(saved.selected || []) };
}

// results kommer färdigfiltrerad från servern; totalt är hela antalet träffar,
// som kan vara fler än de som listas här.
export default function InquiryWizard({ filters, results, totalt }) {
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");

  const cities = useMemo(() => allRegionCities(), []);

  // Själva förfrågan: det besökaren sökte på, plus antal och start. Visas och
  // går att ändra i steg 2. Kommer värdena från AI-sökningen markeras de som
  // förifyllda tills besökaren ändrar dem.
  const [behov, setBehov] = useState(() => ({
    beskrivning: filters.beskrivning || "",
    omrade: filters.omrade || "",
    service: filters.service || "",
    ort: filters.ort || "",
    antal: filters.antal ? String(filters.antal) : "",
    start: filters.start || "",
  }));
  const [aiFalt, setAiFalt] = useState(
    () => new Set(filters.ai ? Object.keys(behov).filter((k) => behov[k]) : [])
  );
  const andraBehov = useCallback((falt, varde) => {
    setBehov((b) => ({ ...b, [falt]: varde }));
    setAiFalt((s) => {
      if (!s.has(falt)) return s;
      const n = new Set(s);
      n.delete(falt);
      return n;
    });
  }, []);
  const starter = useMemo(() => {
    const lista = startAlternativ();
    // En start ur en äldre länk som inte längre finns i listan ska ändå synas.
    return behov.start && !lista.includes(behov.start) ? [behov.start, ...lista] : lista;
  }, [behov.start]);
  // Byter besökaren filter är den gamla bolagsmarkeringen inte längre relevant,
  // medan kontaktuppgifterna fortfarande är det.
  // Ett förvalt bolag (från en profilsida) ingår i signaturen, så att ett äldre
  // utkast med andra bolag markerade inte skriver över förvalet.
  const filterSignature = useMemo(
    () => [filters.omrade || "", filters.service || "", filters.ort || "", filters.bolag || ""].join("|"),
    [filters.omrade, filters.service, filters.ort, filters.bolag]
  );

  const { state: draft, setState: setDraft, patch, restored, clearDraft } = useSessionDraft(
    "forfragan",
    {
      step: 1,
      selected: forval(results),
      filterSignature,
      name: "",
      email: "",
      website: "",
      role: "",
      company: "",
      city: "",
      wantsCall: false,
      phone: "",
    },
    { serialize: serializeDraft, deserialize: deserializeDraft }
  );

  const appliedSignature = useRef(false);
  useEffect(() => {
    if (!restored || appliedSignature.current) return;
    appliedSignature.current = true;
    if (draft.filterSignature !== filterSignature) {
      patch({ selected: forval(results), filterSignature, step: 1 });
    }
  }, [restored, draft.filterSignature, filterSignature, results, patch]);

  const { step, selected } = draft;

  // Den flytande "Gå vidare"-rutan syns bara när ingen av de vanliga
  // knapparna (ovanför och under korten) är i bild, så att besökaren kan
  // bocka i och ur bolag långt ner i listan och gå vidare utan att scrolla.
  const toppKnappar = useRef(null);
  const bottenKnapp = useRef(null);
  const [synligaKnappar, setSynligaKnappar] = useState(() => new Set(["topp"]));
  useEffect(() => {
    if (step !== 1 || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((poster) => {
      setSynligaKnappar((forra) => {
        const nya = new Set(forra);
        for (const p of poster) {
          const namn = p.target.dataset.knapp;
          if (p.isIntersecting) nya.add(namn);
          else nya.delete(namn);
        }
        return nya;
      });
    });
    for (const el of [toppKnappar.current, bottenKnapp.current]) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [step, restored, results.length]);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  // Kvittosteget ligger utanför utkastet: en skickad förfrågan ska inte kunna
  // återuppstå som ett halvfyllt formulär nästa gång sidan öppnas.
  const [sent, setSent] = useState(false);
  // Uppföljningssidan för just den här förfrågan. Samma länk som i
  // bekräftelsemejlet; null om servern inte kunde skapa någon.
  const [uppfoljning, setUppfoljning] = useState(null);
  // Förfrågan går vidare först när avsändaren bekräftat via mejlet. False bara
  // om servern saknar migrationen och granskar manuellt som förut.
  const [masteBekrafta, setMasteBekrafta] = useState(true);
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token), []);

  function toggleCompany(id) {
    setDraft((prev) => {
      const next = new Set(prev.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selected: next };
    });
  }

  function selectAll() {
    patch({ selected: new Set(results.map((c) => c.id)) });
  }

  function deselectAll() {
    patch({ selected: new Set() });
  }

  function goStep1Next() {
    if (selected.size === 0) {
      setError("Välj minst ett bolag att skicka förfrågan till.");
      return;
    }
    setError("");
    patch({ step: 2 });
  }

  function goBackToStep1() {
    setError("");
    patch({ step: 1 });
  }

  // Fel per fält, visade när fältet lämnas. Formuläret kontrollerar samma sak
  // igen vid Skicka, och servern en gång till.
  const [faltfel, setFaltfel] = useState({ email: "", website: "" });
  // Företag i registret som kan vara avsändarens, från uppslaget på domänen.
  const [forslag, setForslag] = useState([]);
  // Värden formuläret självt fyllt i. Bara de skrivs över när e-posten ändras,
  // aldrig något besökaren skrivit själv.
  const autofyllt = useRef({ website: "", company: "", city: "" });
  const senastUppslag = useRef("");

  function fyllOmTomt(falt, varde, nuvarande) {
    const tomt = !nuvarande.trim() || nuvarande === autofyllt.current[falt];
    if (!tomt || !varde) return {};
    autofyllt.current[falt] = varde;
    return { [falt]: varde };
  }

  async function slaUppForetag(doman) {
    if (senastUppslag.current === doman) return;
    senastUppslag.current = doman;
    setForslag([]);

    const sokord = sokordUrDoman(doman);
    if (sokord.length < 2) return;

    try {
      const res = await fetch(`/api/foretag/sok?q=${encodeURIComponent(sokord)}`);
      if (!res.ok) return;
      const { traffar = [] } = await res.json();
      // Svaret kan komma efter att e-posten bytts igen.
      if (senastUppslag.current !== doman) return;

      const lista = traffar.slice(0, 3);
      setForslag(lista);

      // Fyll bara i av sig själv när namnet tydligt hör ihop med domänen:
      // samma ord, med högst ett par bokstäver till eller från ("foretag" och
      // "Företaget AB"). "Företagshuset i Norr" ligger kvar som förslag att
      // klicka på, liksom allt annat uppslaget hittar.
      const nyckel = forenkla(sokord);
      const sakert = lista.find((t) => {
        const namn = forenkla(t.namn);
        if (!namn || !nyckel || Math.abs(namn.length - nyckel.length) > 3) return false;
        return namn.startsWith(nyckel) || nyckel.startsWith(namn);
      });
      if (sakert) valjForslag(sakert, { barTomma: true });
    } catch {
      // Uppslaget är en genväg. Fälten går alltid att fylla i för hand.
    }
  }

  function valjForslag(traff, { barTomma = false } = {}) {
    setDraft((prev) => {
      if (!barTomma) {
        autofyllt.current.company = traff.namn;
        if (traff.postort) autofyllt.current.city = traff.postort;
        return { ...prev, company: traff.namn, city: traff.postort || prev.city };
      }
      return {
        ...prev,
        ...fyllOmTomt("company", traff.namn, prev.company),
        ...fyllOmTomt("city", traff.postort, prev.city),
      };
    });
  }

  function lamnaEpost() {
    const fel = epostFel(draft.email);
    const doman = domanUrEpost(draft.email);
    if (fel || !doman) {
      setFaltfel((f) => ({ ...f, email: fel }));
      return;
    }
    const andring = fyllOmTomt("website", doman, draft.website);
    patch(andring);
    setFaltfel({ email: "", website: webbplatsFel(andring.website ?? draft.website, draft.email) });
    slaUppForetag(doman);
  }

  function lamnaWebbplats() {
    setFaltfel((f) => ({ ...f, website: webbplatsFel(draft.website, draft.email) }));
  }

  function openConfirm(e) {
    e.preventDefault();
    setError("");

    if (!behov.beskrivning.trim()) {
      setError("Beskriv kortfattat vad ni söker under Er förfrågan.");
      return;
    }
    if (behov.antal && !tolkaAntal(behov.antal)) {
      setError(`Antal personer ska vara ett heltal mellan 1 och ${MAX_ANTAL}.`);
      return;
    }

    const felEpost = epostFel(draft.email);
    if (felEpost) {
      setFaltfel((f) => ({ ...f, email: felEpost }));
      return;
    }

    const websiteDomain = domainOf(draft.website.trim());
    const emailDomain = draft.email.split("@")[1]?.toLowerCase();
    if (!websiteDomain || emailDomain !== websiteDomain) {
      setError(`E-postadressen måste matcha er webbplats (${websiteDomain || "okänd domän"}).`);
      return;
    }

    setShowConfirm(true);
  }

  async function confirmSend() {
    setStatus("loading");

    const res = await fetch("/api/forfragan/skicka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyIds: [...selected],
        description: behov.beskrivning.trim(),
        focusArea: behov.omrade,
        service: behov.service,
        region: regionForCity(behov.ort.trim()) || "",
        city: behov.ort.trim(),
        antal: tolkaAntal(behov.antal),
        start: behov.start,
        requesterName: draft.name,
        requesterEmail: draft.email,
        requesterWebsite: draft.website,
        requesterRole: draft.role,
        requesterCompany: draft.company,
        requesterCity: draft.city,
        requesterPhone: draft.wantsCall ? draft.phone : "",
        turnstileToken,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(body.error || "Något gick fel. Försök igen.");
      setShowConfirm(false);
      return;
    }

    const svar = await res.json().catch(() => ({}));
    setUppfoljning(typeof svar.uppfoljning === "string" ? svar.uppfoljning : null);
    setMasteBekrafta(svar.masteBekrafta !== false);
    setStatus("success");
    setShowConfirm(false);
    // Förfrågan är skickad — utkastet ska inte ligga kvar till nästa gång.
    clearDraft();
    setSent(true);
  }

  if (!restored) return null;

  const visibleStep = sent ? 3 : step;

  return (
    <div id="view-rekrytera-results">
      {visibleStep === 1 && (
        filters.bolag ? (
          <Link className="back-link" href={`/bolag/${filters.bolag}`}>&larr; Tillbaka till profilen</Link>
        ) : (
          <Link className="back-link" href={filterHref(filters)}>&larr; Tillbaka till filtret</Link>
        )
      )}
      {/* På steg 1 följer stegen innehållets bredd, så att de linjerar med
          rubriken och korten under. */}
      <div style={{ maxWidth: visibleStep === 1 ? 1180 : 900, margin: "0 auto", padding: "20px 24px 0" }}>
        <Stepper step={visibleStep} total={3} />
      </div>

      {visibleStep === 1 && (
        <>
          <section className="hero">
            <div>
              <div className="eyebrow">Steg 1 av 3 · Rangordnade efter relevans</div>
              <h1 className="hero-title">Välj de bolag <em>ni vill kontakta</em></h1>
              {filters.bolag ? (
                <p className="hero-sub">
                  Förfrågan går till {results[0]?.name}. Vill ni nå fler bolag med samma förfrågan?{" "}
                  <Link href="/rekrytera">Sök bland alla bolag</Link>.
                </p>
              ) : (
                <p className="hero-sub">
                  Visar {results.length}
                  {totalt > results.length ? ` av ${totalt}` : ""} bolag för{" "}
                  {filters.omrade || "alla yrkesområden"} · {filters.ort || "alla orter"}.{" "}
                  {results.length > FORVALDA
                    ? `De ${FORVALDA} mest relevanta är förvalda. Lägg till eller bocka ur efter behov.`
                    : "Bocka ur de ni inte vill skicka förfrågan till."}
                  {totalt > results.length && " Snäva in filtret om ni vill se fler."}
                </p>
              )}
            </div>
          </section>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px 40px" }}>
            <div className="results-bar" ref={toppKnappar} data-knapp="topp">
              <div className="results-count"><b>{selected.size}</b> av {results.length} valda</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <button type="button" className="link-btn" onClick={selectAll}>Välj alla</button>
                <button type="button" className="link-btn" onClick={deselectAll}>Avmarkera alla</button>
                {results.length > 0 && (
                  <button className="qs-btn" style={{ padding: "10px 18px" }} onClick={goStep1Next}>
                    {`Gå vidare (${selected.size} bolag) →`}
                  </button>
                )}
              </div>
            </div>
            {selected.size > VARNA_OVER && (
              <p className="urvalsvarning" role="status">
                {`Ni har valt ${selected.size} bolag. Med fler än ${VARNA_OVER} blir det ofta fler samtal att hantera än svar att välja bland. Bocka gärna ur de minst relevanta.`}
              </p>
            )}
            {results.length === 0 ? (
              <p>Inga bolag matchar filtret. <Link href={filterHref(filters)}>Justera filtret</Link>.</p>
            ) : (
              <div className="grid">
                {results.map((c) => (
                  <SelectableCompanyCard company={c} key={c.id} selected={selected.has(c.id)} onToggle={toggleCompany} />
                ))}
              </div>
            )}
            {error && <p style={{ color: "#c0392b", marginTop: 16 }}>{error}</p>}
            {results.length > 0 && (
              <button
                className="qs-btn"
                style={{ maxWidth: 320, marginTop: 24 }}
                onClick={goStep1Next}
                ref={bottenKnapp}
                data-knapp="botten"
              >
                {`Gå vidare (${selected.size} bolag) →`}
              </button>
            )}
          </div>
          {results.length > 0 && synligaKnappar.size === 0 && (
            <div className="ga-vidare-flyt" role="region" aria-label="Valda bolag">
              <div className="ga-vidare-antal">
                {selected.size === 0 ? (
                  "Inga bolag valda"
                ) : (
                  <>
                    <b>{selected.size}</b> {selected.size === 1 ? "bolag valt" : "bolag valda"}
                  </>
                )}
              </div>
              <button className="qs-btn" type="button" onClick={goStep1Next} disabled={selected.size === 0}>
                Gå vidare med valda bolag &rarr;
              </button>
            </div>
          )}
        </>
      )}

      {visibleStep === 2 && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 24px 60px" }}>
          <div className="eyebrow">Steg 2 av 3</div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>Verifiera <em>dig själv</em></h1>
          <p className="hero-sub">
            Kontrollera er förfrågan och ändra om något inte stämmer. Ange sedan din jobbadress. Den måste ha samma
            domän som er webbplats, så att bolagen vet att förfrågan är äkta, och vi fyller i det vi kan utifrån den.
          </p>
          <ForfraganDetaljer behov={behov} aiFalt={aiFalt} andra={andraBehov} starter={starter} orter={cities} />
          <form className="auth-panel" onSubmit={openConfirm} style={{ marginTop: 16 }}>
            <div className="ff-rubrik">Om dig</div>
            <div className="field">
              <label htmlFor="inq-email">E-post (jobb)</label>
              <input
                id="inq-email"
                type="email"
                value={draft.email}
                onChange={(e) => {
                  patch({ email: e.target.value });
                  if (faltfel.email) setFaltfel((f) => ({ ...f, email: "" }));
                }}
                onBlur={lamnaEpost}
                placeholder="anna@foretag.se"
                autoComplete="email"
                aria-invalid={Boolean(faltfel.email)}
                aria-describedby={faltfel.email ? "inq-email-fel" : undefined}
                required
              />
              {faltfel.email && <p id="inq-email-fel" className="field-error">{faltfel.email}</p>}
            </div>
            <div className="field">
              <label htmlFor="inq-website">Webbplats (företag)</label>
              <input
                id="inq-website"
                value={draft.website}
                onChange={(e) => {
                  patch({ website: e.target.value });
                  if (faltfel.website) setFaltfel((f) => ({ ...f, website: "" }));
                }}
                onBlur={lamnaWebbplats}
                placeholder="foretag.se"
                aria-invalid={Boolean(faltfel.website)}
                aria-describedby={faltfel.website ? "inq-website-fel" : undefined}
                required
              />
              {faltfel.website ? (
                <p id="inq-website-fel" className="field-error">{faltfel.website}</p>
              ) : (
                <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
                  Fylls i från din e-post. Ändra om webbplatsen har en annan adress med samma domän.
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="inq-company">Företag</label>
              <input id="inq-company" value={draft.company} onChange={(e) => patch({ company: e.target.value })} required />
              {forslag.length > 0 && (
                <div className="foretagsforslag">
                  <span>Förslag från registret:</span>
                  {forslag.map((t) => (
                    <button
                      type="button"
                      key={t.orgnr}
                      className={`chip${draft.company === t.namn ? " on" : ""}`}
                      onClick={() => valjForslag(t)}
                    >
                      {t.namn}
                      {t.postort ? `, ${t.postort}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor="inq-city">Ort</label>
              <input
                id="inq-city"
                list="inq-city-list"
                value={draft.city}
                onChange={(e) => patch({ city: e.target.value })}
                autoComplete="off"
                required
              />
              <datalist id="inq-city-list">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="inq-name">Namn</label>
              <input id="inq-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="inq-role">Din roll</label>
              <input id="inq-role" value={draft.role} onChange={(e) => patch({ role: e.target.value })} required />
            </div>
            <div className="field">
              <label className="checkbox-row" htmlFor="inq-wants-call">
                <input
                  id="inq-wants-call"
                  type="checkbox"
                  checked={draft.wantsCall}
                  onChange={(e) => patch({ wantsCall: e.target.checked })}
                />
                Jag vill bli uppringd snarast möjligt
              </label>
              {draft.wantsCall && (
                <input
                  id="inq-phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  placeholder="Telefonnummer (valfritt)"
                  style={{ marginTop: 10 }}
                />
              )}
            </div>
            <Turnstile onVerify={handleTurnstileVerify} />

            {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={goBackToStep1}>Tillbaka</button>
              <button
                className="qs-btn"
                type="submit"
                disabled={TURNSTILE_SITE_KEY && !turnstileToken}
              >
                {`Skicka förfrågan (${selected.size} bolag)`}
              </button>
            </div>
          </form>
        </div>
      )}

      {showConfirm && (
        <div
          className="confirm-overlay"
          onClick={() => status !== "loading" && setShowConfirm(false)}
        >
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{`Skicka till ${selected.size} bolag?`}</h3>
            <p className="sub">
              Dessa bolag får se er förfrågan så snart du bekräftat den via mejlet vi skickar:
            </p>
            <ul className="confirm-company-list">
              {results
                .filter((c) => selected.has(c.id))
                .map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
            </ul>
            {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div className="confirm-actions">
              <button
                className="btn btn-ghost"
                type="button"
                disabled={status === "loading"}
                onClick={() => setShowConfirm(false)}
              >
                Avbryt
              </button>
              <button className="qs-btn" type="button" disabled={status === "loading"} onClick={confirmSend}>
                {status === "loading" ? "Skickar..." : "Bekräfta och skicka"}
              </button>
            </div>
          </div>
        </div>
      )}

      {visibleStep === 3 && (
        <div style={{ maxWidth: 480, margin: "20px auto 60px", padding: "0 24px", textAlign: "center" }}>
          <div className="auth-panel">
            <h2 style={{ marginTop: 0 }}>{masteBekrafta ? "Ett steg kvar" : "Tack!"}</h2>
            <p>
              {masteBekrafta
                ? `Vi har skickat ett mejl till ${draft.email}. Tryck på "Bekräfta och skicka" i mejlet, så går förfrågan vidare till de ${selected.size} valda bolagen. De kan sedan höra av sig direkt till dig.`
                : `Er förfrågan skickades till granskning hos Recruitable. Så snart den är godkänd ser de ${selected.size} valda bolagen den under sina Mina sidor och kan höra av sig direkt till dig på ${draft.email}.`}
            </p>
            {uppfoljning && !masteBekrafta ? (
              <>
                <p>Följ förfrågan på en egen sida: där ser du vilka bolag som är intresserade, har tackat nej eller inte svarat än. Länken finns också i bekräftelsemejlet.</p>
                <Link className="qs-btn" href={uppfoljning} style={{ display: "inline-block", textDecoration: "none" }}>
                  Följ förfrågan
                </Link>
              </>
            ) : (
              <Link className="qs-btn" href="/" style={{ display: "inline-block", textDecoration: "none" }}>
                Till startsidan
              </Link>
            )}
          </div>
          <SkrappostPaminnelse adress={draft.email} bekrafta={masteBekrafta ? "förfrågan" : undefined} />
        </div>
      )}
    </div>
  );
}
