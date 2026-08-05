"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { YRKESOMRADEN } from "@/lib/taxonomy";

const SERVICE_OPTIONS = ["Bemanning", "Rekrytering", "Interim"];

export default function RegisterForm() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState(null);

  const [companyName, setCompanyName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  const [focusAreas, setFocusAreas] = useState([]);
  const [services, setServices] = useState([]);

  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleStep1(e) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

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

    setUserId(id);
    setStatus("idle");
    setStep(2);
  }

  function handleStep2(e) {
    e.preventDefault();
    setStep(3);
  }

  function toggleFocusArea(area) {
    setFocusAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  function toggleService(service) {
    setServices((prev) => (prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]));
  }

  function toggleAllServices() {
    setServices((prev) => (prev.length === SERVICE_OPTIONS.length ? [] : [...SERVICE_OPTIONS]));
  }

  async function handleStep3(e) {
    e.preventDefault();
    setErrorMsg("");

    if (focusAreas.length === 0 || services.length === 0) {
      setStatus("error");
      setErrorMsg("Välj minst ett yrkesområde och minst en tjänst.");
      return;
    }

    setStatus("loading");

    const res = await fetch("/api/auth/registrera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, companyName, orgNumber, address, website, focusAreas, services }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMsg(body.error || "Något gick fel. Kontakta info@recruitable.se.");
      return;
    }

    setStatus("success");
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
          <input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="reg-email">E-post</label>
          <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="reg-password">Lösenord</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
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
          <input
            id="reg-company-name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-org-number">Org.nummer</label>
          <input
            id="reg-org-number"
            type="text"
            placeholder="XXXXXX-XXXX"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="reg-website">Webbplats</label>
          <input
            id="reg-website"
            type="text"
            placeholder="www.bolaget.se"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            required
          />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
            Måste matcha samma domän som din e-postadress.
          </p>
        </div>
        <div className="field">
          <label htmlFor="reg-address">Adress</label>
          <input
            id="reg-address"
            type="text"
            placeholder="Gatuadress, postnummer och ort"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 6 }}>
            Ange kontoret du representerar — bolag med flera orter kan ha olika administratörer.
          </p>
        </div>
        <button className="qs-btn" type="submit">Nästa</button>
      </form>
    );
  }

  return (
    <form className="auth-panel" onSubmit={handleStep3}>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0, marginBottom: 18 }}>
        Steg 3 av 3 — Profiler
      </p>

      <div className="field">
        <label>Yrkesområden ni rekryterar inom</label>
        <div className="checkbox-list">
          {Object.keys(YRKESOMRADEN).map((area) => (
            <label className="checkbox-row" key={area}>
              <input
                type="checkbox"
                checked={focusAreas.includes(area)}
                onChange={() => toggleFocusArea(area)}
              />
              {area}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Tjänster</label>
        <div className="checkbox-list" style={{ maxHeight: "none" }}>
          <label className="checkbox-row" style={{ fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={services.length === SERVICE_OPTIONS.length}
              onChange={toggleAllServices}
            />
            Alla nedanstående
          </label>
          {SERVICE_OPTIONS.map((service) => (
            <label className="checkbox-row" key={service}>
              <input
                type="checkbox"
                checked={services.includes(service)}
                onChange={() => toggleService(service)}
              />
              {service}
            </label>
          ))}
        </div>
      </div>

      {status === "error" && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 16 }}>{errorMsg}</p>}
      <button className="qs-btn" type="submit" disabled={status === "loading"} style={{ marginTop: 20 }}>
        {status === "loading" ? "Skickar..." : "Begär tillgång"}
      </button>
    </form>
  );
}
