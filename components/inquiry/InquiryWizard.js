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

  const description = filters.beskrivning || "";
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
      selected: new Set(results.map((c) => c.id)),
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
      patch({ selected: new Set(results.map((c) => c.id)), filterSignature, step: 1 });
    }
  }, [restored, draft.filterSignature, filterSignature, results, patch]);

  const { step, selected } = draft;

  const [turnstileToken, setTurnstileToken] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  // Kvittosteget ligger utanför utkastet: en skickad förfrågan ska inte kunna
  // återuppstå som ett halvfyllt formulär nästa gång sidan öppnas.
  const [sent, setSent] = useState(false);
  // Uppföljningssidan för just den här förfrågan. Samma länk som i
  // bekräftelsemejlet; null om servern inte kunde skapa någon.
  const [uppfoljning, setUppfoljning] = useState(null);
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
        description,
        focusArea: filters.omrade || "",
        service: filters.service || "",
        region: regionForCity(filters.ort) || "",
        city: filters.ort || "",
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
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
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
                  {filters.omrade || "alla yrkesområden"} · {filters.ort || "alla orter"}. Bocka ur de ni
                  inte vill skicka förfrågan till.
                  {totalt > results.length && " Snäva in filtret om ni vill se fler."}
                </p>
              )}
            </div>
          </section>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px 40px" }}>
            <div className="results-bar">
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
              <button className="qs-btn" style={{ maxWidth: 320, marginTop: 24 }} onClick={goStep1Next}>
                {`Gå vidare (${selected.size} bolag) →`}
              </button>
            )}
          </div>
        </>
      )}

      {visibleStep === 2 && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 24px 60px" }}>
          <div className="eyebrow">Steg 2 av 3</div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>Verifiera <em>dig själv</em></h1>
          <p className="hero-sub">
            Börja med din jobbadress. Den måste ha samma domän som er webbplats, så att bolagen vet att förfrågan är
            äkta, och vi fyller i det vi kan utifrån den.
          </p>
          <form className="auth-panel" onSubmit={openConfirm} style={{ marginTop: 24 }}>
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
              Dessa bolag får se er förfrågan så snart Recruitable har granskat och godkänt den:
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
            <h2 style={{ marginTop: 0 }}>Tack!</h2>
            <p>
              {`Er förfrågan skickades till granskning hos Recruitable. Så snart den är godkänd ser de ${selected.size} valda bolagen den under sina Mina sidor och kan höra av sig direkt till dig på ${draft.email}.`}
            </p>
            {uppfoljning ? (
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
          <SkrappostPaminnelse adress={draft.email} />
        </div>
      )}
    </div>
  );
}
