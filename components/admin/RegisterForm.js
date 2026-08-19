"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import MultiSelectField from "@/components/MultiSelectField";
import PasswordField from "@/components/PasswordField";
import ForetagsSok from "@/components/admin/ForetagsSok";

const SERVICE_OPTIONS = ["Bemanning", "Rekrytering", "Interim", "Search"];

const EMPTY_FORM = {
  step: 1,
  name: "",
  email: "",
  companyName: "",
  orgNumber: "",
  gatuadress: "",
  postnummer: "",
  postort: "",
  website: "",
  focusAreas: [],
  services: [],
  // Sätts när kontot väl är skapat i Supabase, så att ett steg bakåt och framåt
  // igen inte försöker skapa samma konto en gång till.
  userId: null,
  accountEmail: "",
};

function domainFromEmail(email) {
  const domain = String(email || "").split("@")[1];
  return domain ? domain.trim().toLowerCase() : "";
}

export default function RegisterForm() {
  // Allt utom lösenordet sparas som utkast, så att stegen går att backa i och
  // rätta — även efter en omladdning eller webbläsarens bakåtknapp.
  const { state: form, patch, restored, clearDraft } = useSessionDraft("registrera", EMPTY_FORM);

  // Lösenordet ligger utanför utkastet och överlever därför varken omladdning
  // eller stängd flik.
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const handleTurnstileVerify = useCallback((token) => setTurnstileToken(token), []);
  const handleTurnstileError = useCallback((failed) => setTurnstileFailed(failed), []);

  const [lookup, setLookup] = useState({ status: "idle", info: null, message: "" });
  const lastLookedUpOrgnr = useRef("");

  const { step, userId, accountEmail, email, website } = form;

  // Webbplatsen måste ändå matcha e-postens domän — fyll den åt användaren så fort
  // vi vet vilken domän det gäller, men rör aldrig något hen själv skrivit.
  useEffect(() => {
    if (step !== 2 || website) return;
    const domain = domainFromEmail(email);
    if (domain) patch({ website: `www.${domain}` });
  }, [step, website, email, patch]);

  async function slaUpp(rawOrgnr) {
    const digits = String(rawOrgnr || "").replace(/\D/g, "");
    if (digits.length !== 10 || digits === lastLookedUpOrgnr.current) return;
    lastLookedUpOrgnr.current = digits;

    setLookup({ status: "loading", info: null, message: "" });
    try {
      const res = await fetch(`/api/foretag/uppslag?orgnr=${encodeURIComponent(digits)}`);
      const body = await res.json();
      if (!res.ok) {
        setLookup({ status: "miss", info: null, message: body.error || "Hittade inget bolag." });
        return;
      }
      // Skriv bara i fält som är tomma — det användaren själv fyllt i väger tyngre
      // än registerdatan, t.ex. när kontoret ligger på en annan adress än sätet.
      patch((prev) => ({
        orgNumber: body.orgnr || prev.orgNumber,
        companyName: prev.companyName || body.namn || "",
        gatuadress: prev.gatuadress || body.gatuadress || "",
        postnummer: prev.postnummer || body.postnummer || "",
        postort: prev.postort || body.postort || "",
      }));
      setLookup({ status: "ok", info: body, message: "" });
    } catch {
      setLookup({ status: "miss", info: null, message: "Kunde inte nå registret just nu." });
    }
  }

  function handleSelectCompany(candidate) {
    lastLookedUpOrgnr.current = "";
    patch({
      companyName: candidate.namn,
      orgNumber: candidate.orgnr,
      gatuadress: candidate.gatuadress || "",
      postnummer: candidate.postnummer || "",
      postort: candidate.postort || "",
    });
    slaUpp(candidate.orgnr);
  }

  async function handleStep1(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    // Kontot kan redan vara skapat om användaren gått tillbaka hit för att rätta
    // något. Bara en ny e-postadress kräver en ny registrering.
    if (userId && accountEmail === email) {
      setStatus("idle");
      patch({ step: 2 });
      return;
    }

    if (userId && accountEmail !== email && !password) {
      setStatus("error");
      setErrorMsg("Ange lösenordet igen för att byta e-postadress.");
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    const id = data.user?.id;
    if (!id) {
      setStatus("error");
      setErrorMsg("Något gick fel vid registreringen. Försök igen.");
      return;
    }

    setStatus("idle");
    patch({ userId: id, accountEmail: email, step: 2 });
  }

  function handleStep2(e) {
    e.preventDefault();
    setErrorMsg("");
    setStatus("idle");
    patch({ step: 3 });
  }

  function goBack() {
    setErrorMsg("");
    setStatus("idle");
    patch((prev) => ({ step: Math.max(1, prev.step - 1) }));
  }

  function removeFocusArea(area) {
    patch({ focusAreas: form.focusAreas.filter((a) => a !== area) });
  }

  function removeService(service) {
    patch({ services: form.services.filter((s) => s !== service) });
  }

  async function handleStep3(e) {
    e.preventDefault();
    setErrorMsg("");

    if (form.focusAreas.length === 0 || form.services.length === 0) {
      setStatus("error");
      setErrorMsg("Välj minst ett yrkesområde och minst en tjänst.");
      return;
    }

    setStatus("loading");

    const res = await fetch("/api/auth/registrera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        companyName: form.companyName,
        orgNumber: form.orgNumber,
        gatuadress: form.gatuadress,
        postnummer: form.postnummer,
        postort: form.postort,
        website: form.website,
        focusAreas: form.focusAreas,
        services: form.services,
        turnstileToken,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMsg(body.error || "Något gick fel. Kontakta info@recruitable.se.");
      return;
    }

    // Begäran är inne — utkastet ska inte ligga kvar och dyka upp nästa gång.
    clearDraft();
    setStatus("success");
  }

  // Vänta med att rita formuläret tills utkastet lästs in, så att användaren inte
  // hinner se tomma fält som en sekund senare fylls i.
  if (!restored) {
    return <div className="auth-panel" aria-busy="true" />;
  }

  if (status === "success") {
    return (
      <div className="auth-panel">
        <p>
          Tack! Kolla din e-post för att bekräfta kontot. När det är gjort granskar vi din begäran manuellt
          — ni får besked så snart kontot är godkänt.
        </p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <form className="auth-panel" onSubmit={handleStep1}>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
          Steg 1 av 3 — Dina uppgifter
        </p>
        <div className="field">
          <label htmlFor="reg-name">För- & Efternamn</label>
          <input
            id="reg-name"
            type="text"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-email">E-post</label>
          <input
            id="reg-email"
            type="email"
            value={form.email}
            onChange={(e) => patch({ email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-password">Lösenord</label>
          <PasswordField
            id="reg-password"
            value={password}
            onChange={setPassword}
            required={!userId}
            minLength={8}
          />
          {userId && (
            <p className="hint">
              Kontot är redan skapat. Lösenordet behövs bara om du byter e-postadress här.
            </p>
          )}
        </div>
        {status === "error" && <p style={{ color: "#c0392b", fontSize: 13 }}>{errorMsg}</p>}
        <button className="qs-btn" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Skickar..." : "Nästa"}
        </button>
      </form>
    );
  }

  if (step === 2) {
    return (
      <form className="auth-panel" onSubmit={handleStep2}>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
          Steg 2 av 3 — Ert bolag
        </p>
        <div className="field">
          <label htmlFor="reg-company-name">Företagsnamn</label>
          <ForetagsSok
            id="reg-company-name"
            value={form.companyName}
            onChange={(value) => patch({ companyName: value })}
            onSelect={handleSelectCompany}
          />
          <p className="hint">
            Börja skriva så söker vi upp bolaget och fyller i org.nummer och adress åt dig.
          </p>
        </div>
        <div className="field">
          <label htmlFor="reg-org-number">Org.nummer</label>
          <input
            id="reg-org-number"
            type="text"
            placeholder="XXXXXX-XXXX"
            value={form.orgNumber}
            onChange={(e) => patch({ orgNumber: e.target.value })}
            onBlur={(e) => slaUpp(e.target.value)}
            required
          />
          {lookup.status === "loading" && <p className="hint">Hämtar uppgifter…</p>}
          {lookup.status === "ok" && lookup.info && (
            <>
              <p className="hint">
                {`Hämtat från ${lookup.info.kallor.join(" och ")}: ${[
                  lookup.info.namn,
                  lookup.info.bolagsform,
                  lookup.info.registreringsdatum && `registrerat ${lookup.info.registreringsdatum}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}`}
              </p>
              {(lookup.info.avregistrerad || lookup.info.aktiv === false) && (
                <p className="hint" style={{ color: "#c0392b" }}>
                  Registret anger bolaget som{" "}
                  {lookup.info.avregistrerad ? "avregistrerat" : "ej verksamt"} — kontrollera att
                  org.numret stämmer.
                </p>
              )}
            </>
          )}
          {lookup.status === "miss" && <p className="hint">{lookup.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="reg-website">Webbplats</label>
          <input
            id="reg-website"
            type="text"
            placeholder="www.bolaget.se"
            value={form.website}
            onChange={(e) => patch({ website: e.target.value })}
            required
          />
          <p className="hint">Måste matcha samma domän som din e-postadress.</p>
        </div>
        <div className="field">
          <label htmlFor="reg-gatuadress">Gatuadress</label>
          <input
            id="reg-gatuadress"
            type="text"
            placeholder="Storgatan 1"
            value={form.gatuadress}
            onChange={(e) => patch({ gatuadress: e.target.value })}
            autoComplete="street-address"
            required
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="reg-postnummer">Postnummer</label>
            <input
              id="reg-postnummer"
              type="text"
              inputMode="numeric"
              placeholder="411 34"
              value={form.postnummer}
              onChange={(e) => patch({ postnummer: e.target.value })}
              autoComplete="postal-code"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reg-postort">Postort</label>
            <input
              id="reg-postort"
              type="text"
              placeholder="Göteborg"
              value={form.postort}
              onChange={(e) => patch({ postort: e.target.value })}
              autoComplete="address-level2"
              required
            />
          </div>
        </div>
        <p className="hint" style={{ marginTop: -10 }}>
          Ange kontoret du representerar — bolag med flera orter kan ha olika administratörer.
        </p>
        <div className="step-nav">
          <button className="btn btn-ghost" type="button" onClick={goBack}>
            &larr; Tillbaka
          </button>
          <button className="qs-btn" type="submit">Nästa</button>
        </div>
      </form>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleStep3}>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
        Steg 3 av 3 — Profiler
      </p>

      <div className="field">
        <label htmlFor="reg-add-service">Tjänster</label>
        <MultiSelectField
          id="reg-add-service"
          options={SERVICE_OPTIONS}
          selected={form.services}
          onChange={(services) => patch({ services })}
          placeholder="Välj tjänster..."
        />
        {form.services.length > 0 && (
          <div className="chip-list">
            {form.services.map((service) => (
              <span className="chip" key={service}>
                {service}
                <button type="button" onClick={() => removeService(service)} aria-label={`Ta bort ${service}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="reg-add-area">Yrkesområden ni rekryterar inom</label>
        <MultiSelectField
          id="reg-add-area"
          options={Object.keys(YRKESOMRADEN)}
          selected={form.focusAreas}
          onChange={(focusAreas) => patch({ focusAreas })}
          placeholder="Välj yrkesområden..."
        />
        {form.focusAreas.length > 0 && (
          <div className="chip-list">
            {form.focusAreas.map((area) => (
              <span className="chip" key={area}>
                {area}
                <button type="button" onClick={() => removeFocusArea(area)} aria-label={`Ta bort ${area}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <Turnstile onVerify={handleTurnstileVerify} onError={handleTurnstileError} />

      {turnstileFailed && (
        <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>
          Robotkontrollen kunde inte genomföras, så det går inte att skicka just nu. Ladda om sidan
          och försök igen — dina uppgifter finns kvar. Kvarstår felet, hör av dig till
          info@recruitable.se så tar vi emot er begäran manuellt.
        </p>
      )}

      {status === "error" && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 16 }}>{errorMsg}</p>}
      <div className="step-nav" style={{ marginTop: 20 }}>
        <button className="btn btn-ghost" type="button" onClick={goBack} disabled={status === "loading"}>
          &larr; Tillbaka
        </button>
        <button
          className="qs-btn"
          type="submit"
          disabled={status === "loading" || (TURNSTILE_SITE_KEY && !turnstileToken)}
        >
          {status === "loading" ? "Skickar..." : "Begär tillgång"}
        </button>
      </div>
    </form>
  );
}
