"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { filterCompanies, regionForCity } from "@/lib/helpers";
import Stepper from "@/components/wizard/Stepper";
import SelectableCompanyCard from "./SelectableCompanyCard";

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

  const [description, setDescription] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");

  function toggleCompany(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goStep1Next() {
    if (selected.size === 0) {
      setError("Välj minst ett bolag att skicka förfrågan till.");
      return;
    }
    setError("");
    setStep(2);
  }

  function goStep2Next() {
    if (!description.trim()) {
      setError("Beskriv kortfattat vad ni söker.");
      return;
    }
    setError("");
    setStep(3);
  }

  async function submitStep3(e) {
    e.preventDefault();
    setError("");

    const websiteDomain = domainOf(website.trim());
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!websiteDomain || emailDomain !== websiteDomain) {
      setError(`E-postadressen måste matcha er webbplats (${websiteDomain || "okänd domän"}).`);
      return;
    }

    setStatus("loading");

    const res = await fetch("/api/forfragan/skicka", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyIds: [...selected],
        description,
        searchRole: filters.sokroll || "",
        focusArea: filters.omrade || "",
        service: filters.service || "",
        region: regionForCity(filters.ort) || "",
        city: filters.ort || "",
        requireKa: !!filters.requireKa,
        requireAuktorisation: !!filters.requireAuktorisation,
        requesterName: name,
        requesterEmail: email,
        requesterWebsite: website,
        requesterRole: role,
        requesterCompany: company,
        requesterCity: city,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(body.error || "Något gick fel. Försök igen.");
      return;
    }

    setStatus("success");
    setStep(4);
  }

  return (
    <div id="view-partners-results">
      {step === 1 && <Link className="back-link" href="/partners">&larr; Tillbaka till filtret</Link>}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
        <Stepper step={step} total={4} />
      </div>

      {step === 1 && (
        <>
          <section className="hero">
            <div>
              <div className="eyebrow">Steg 1 av 4 · Rangordnade efter relevans</div>
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
            </div>
            {results.length === 0 ? (
              <p>Inga bolag matchar filtret. <Link href="/partners">Justera filtret</Link>.</p>
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
                Gå vidare ({selected.size} bolag) &rarr;
              </button>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 24px 60px" }}>
          <div className="eyebrow">Steg 2 av 4</div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>Beskriv <em>behovet</em></h1>
          <p className="hero-sub">
            Vad söker ni, och när ska rollen tillsättas? De {selected.size} bolag ni valt får den här texten.
          </p>
          <div className="field" style={{ marginTop: 24 }}>
            <label htmlFor="inq-desc">Beskrivning</label>
            <textarea
              id="inq-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 350))}
              maxLength={350}
              rows={6}
              placeholder="T.ex. roll, omfattning, önskad start och annat som är bra för bolagen att veta."
            />
            <div className="char-counter">{description.length}/350 tecken</div>
          </div>
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>Tillbaka</button>
            <button className="qs-btn" type="button" onClick={goStep2Next}>Nästa</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 24px 60px" }}>
          <div className="eyebrow">Steg 3 av 4</div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>Verifiera <em>dig själv</em></h1>
          <p className="hero-sub">
            Din e-postadress måste matcha er webbplats, så bolagen vet att förfrågan är äkta.
          </p>
          <form className="auth-panel" onSubmit={submitStep3} style={{ marginTop: 24 }}>
            <div className="field">
              <label htmlFor="inq-name">Namn</label>
              <input id="inq-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-email">E-post</label>
              <input id="inq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-website">Webbplats</label>
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
            <div className="field">
              <label htmlFor="inq-role">Din roll</label>
              <input id="inq-role" value={role} onChange={(e) => setRole(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-company">Företag</label>
              <input id="inq-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inq-city">Ort</label>
              <input id="inq-city" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>Tillbaka</button>
              <button className="qs-btn" type="submit" disabled={status === "loading"}>
                {status === "loading" ? "Skickar..." : "Skicka förfrågan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 4 && (
        <div style={{ maxWidth: 480, margin: "20px auto 60px", padding: "0 24px", textAlign: "center" }}>
          <div className="auth-panel">
            <h2 style={{ marginTop: 0 }}>Tack!</h2>
            <p>
              Er förfrågan har skickats till {selected.size} bolag. De ser den under sina Mina sidor och hör av
              sig direkt till dig på {email}.
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
