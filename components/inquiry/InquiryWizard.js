"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { filterCompanies, regionForCity } from "@/lib/helpers";
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

export default function InquiryWizard({ filters }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle");

  const results = useMemo(() => filterCompanies(COMPANIES, filters), [filters]);
  const [selected, setSelected] = useState(() => new Set(results.map((c) => c.id)));

  const [description] = useState(filters.beskrivning || "");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [wantsCall, setWantsCall] = useState(false);
  const [phone, setPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token), []);

  function toggleCompany(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(results.map((c) => c.id)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function goStep1Next() {
    if (selected.size === 0) {
      setError("Välj minst ett bolag att skicka förfrågan till.");
      return;
    }
    setError("");
    setStep(2);
  }

  function openConfirm(e) {
    e.preventDefault();
    setError("");

    const websiteDomain = domainOf(website.trim());
    const emailDomain = email.split("@")[1]?.toLowerCase();
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
        requesterName: name,
        requesterEmail: email,
        requesterWebsite: website,
        requesterRole: role,
        requesterCompany: company,
        requesterCity: city,
        requesterPhone: wantsCall ? phone : "",
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
    setStep(3);
  }

  return (
    <div id="view-rekrytera-results">
      {step === 1 && <Link className="back-link" href="/rekrytera">&larr; Tillbaka till filtret</Link>}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
        <Stepper step={step} total={3} />
      </div>

      {step === 1 && (
        <>
          <section className="hero">
            <div>
              <div className="eyebrow">Steg 1 av 3 · Rangordnade efter relevans</div>
              <h1 className="hero-title">Välj de bolag <em>ni vill kontakta</em></h1>
              <p className="hero-sub">
                Visar {results.length} bolag för {filters.omrade || "alla yrkesområden"} ·{" "}
                {filters.ort || "alla orter"}. Bocka ur de ni inte vill skicka förfrågan till.
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
              <p>Inga bolag matchar filtret. <Link href="/rekrytera">Justera filtret</Link>.</p>
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

      {step === 2 && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 24px 60px" }}>
          <div className="eyebrow">Steg 2 av 3</div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>Verifiera <em>dig själv</em></h1>
          <p className="hero-sub">
            Din e-postadress måste matcha er webbplats, så bolagen vet att förfrågan är äkta.
          </p>
          <form className="auth-panel" onSubmit={openConfirm} style={{ marginTop: 24 }}>
            <div className="field">
              <label htmlFor="inq-name">Namn</label>
              <input id="inq-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-company">Företag</label>
              <input id="inq-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-role">Din roll</label>
              <input id="inq-role" value={role} onChange={(e) => setRole(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-email">E-post</label>
              <input id="inq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="checkbox-row" htmlFor="inq-wants-call">
                <input
                  id="inq-wants-call"
                  type="checkbox"
                  checked={wantsCall}
                  onChange={(e) => setWantsCall(e.target.checked)}
                />
                Jag vill bli uppringd snarast möjligt
              </label>
              {wantsCall && (
                <input
                  id="inq-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefonnummer (valfritt)"
                  style={{ marginTop: 10 }}
                />
              )}
            </div>
            <div className="field">
              <label htmlFor="inq-city">Ort</label>
              <input id="inq-city" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-website">Webbplats (företag)</label>
              <input
                id="inq-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
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
              <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>Tillbaka</button>
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

      {step === 3 && (
        <div style={{ maxWidth: 480, margin: "20px auto 60px", padding: "0 24px", textAlign: "center" }}>
          <div className="auth-panel">
            <h2 style={{ marginTop: 0 }}>Tack!</h2>
            <p>
              {`Er förfrågan skickades till granskning hos Recruitable. Så snart den är godkänd ser de ${selected.size} valda bolagen den under sina Mina sidor och kan höra av sig direkt till dig på ${email}.`}
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
