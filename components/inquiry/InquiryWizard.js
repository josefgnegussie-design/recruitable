"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { allRegionCities, regionForCity } from "@/lib/helpers";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Stepper from "@/components/wizard/Stepper";
import SelectableCompanyCard from "./SelectableCompanyCard";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";

function domainOf(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
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
  const filterSignature = useMemo(
    () => [filters.omrade || "", filters.service || "", filters.ort || ""].join("|"),
    [filters.omrade, filters.service, filters.ort]
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

  function openConfirm(e) {
    e.preventDefault();
    setError("");

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
        <Link className="back-link" href={filterHref(filters)}>&larr; Tillbaka till filtret</Link>
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
              <p className="hero-sub">
                Visar {results.length}
                {totalt > results.length ? ` av ${totalt}` : ""} bolag för{" "}
                {filters.omrade || "alla yrkesområden"} · {filters.ort || "alla orter"}. Bocka ur de ni
                inte vill skicka förfrågan till.
                {totalt > results.length && " Snäva in filtret om ni vill se fler."}
              </p>
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
            Din e-postadress måste matcha er webbplats, så bolagen vet att förfrågan är äkta.
          </p>
          <form className="auth-panel" onSubmit={openConfirm} style={{ marginTop: 24 }}>
            <div className="field">
              <label htmlFor="inq-name">Namn</label>
              <input id="inq-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="inq-company">Företag</label>
              <input id="inq-company" value={draft.company} onChange={(e) => patch({ company: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="inq-role">Din roll</label>
              <input id="inq-role" value={draft.role} onChange={(e) => patch({ role: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="inq-email">E-post</label>
              <input
                id="inq-email"
                type="email"
                value={draft.email}
                onChange={(e) => patch({ email: e.target.value })}
                required
              />
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
              <label htmlFor="inq-website">Webbplats (företag)</label>
              <input
                id="inq-website"
                value={draft.website}
                onChange={(e) => patch({ website: e.target.value })}
                placeholder="www.erabolag.se"
                required
              />
              <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
                Måste matcha samma domän som din e-postadress.
              </p>
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
            <Link className="qs-btn" href="/" style={{ display: "inline-block", textDecoration: "none" }}>
              Till startsidan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
