"use client";

import { useState } from "react";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import MultiSelectField from "@/components/MultiSelectField";
import ImageUploadField from "@/components/admin/ImageUploadField";

const SERVICE_OPTIONS = ["Bemanning", "Rekrytering", "Interim", "Search"];

// Uppgifterna bolaget självt svarar för. De objektiva fälten visas bredvid, men
// går inte att ändra — de kommer från Bolagsverket och årsredovisningar, och är
// skälet att lita på registret.
export default function GrundprofilEditor({ company }) {
  const [vision, setVision] = useState(company.vision || "");
  const [description, setDescription] = useState(company.description || "");
  const [focus, setFocus] = useState(company.focus || []);
  const [services, setServices] = useState(company.services || []);
  const [link, setLink] = useState(company.link || "");
  const [contact, setContact] = useState(company.contact || "");
  const [ka, setKa] = useState(Boolean(company.ka));
  const [logo, setLogo] = useState(company.logo || "");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const res = await fetch("/api/profil/grunduppgifter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        vision,
        description,
        focus,
        services,
        link,
        contact,
        ka,
        logo,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(body.error || "Kunde inte spara. Försök igen.");
      return;
    }

    setStatus("sparat");
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Er profil</h3>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        Det här är uppgifterna ni själva svarar för. Omsättning, antal anställda, adress och
        organisationsnummer hämtas från Bolagsverket och årsredovisningar och går inte att ändra —
        det är den grunden som gör registret jämförbart.
      </p>

      <div className="field">
        <label htmlFor="gp-vision">Vision</label>
        <textarea
          id="gp-vision"
          value={vision}
          onChange={(e) => setVision(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={2}
          placeholder="Vad vill ni åstadkomma? Visas som citat på er profil."
        />
        <div className="char-counter">{vision.length}/500 tecken</div>
      </div>

      <div className="field">
        <label htmlFor="gp-description">Om bolaget</label>
        <textarea
          id="gp-description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          maxLength={2000}
          rows={5}
          placeholder="Vad gör ni, för vilka, och vad skiljer er från andra?"
        />
        <div className="char-counter">{description.length}/2000 tecken</div>
      </div>

      <div className="field">
        <label htmlFor="gp-focus">Yrkesområden ni rekryterar inom</label>
        <MultiSelectField
          id="gp-focus"
          options={Object.keys(YRKESOMRADEN)}
          selected={focus}
          onChange={setFocus}
          placeholder="Välj yrkesområden..."
        />
      </div>

      <div className="field">
        <label htmlFor="gp-services">Tjänster</label>
        <MultiSelectField
          id="gp-services"
          options={SERVICE_OPTIONS}
          selected={services}
          onChange={setServices}
          placeholder="Välj tjänster..."
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="gp-link">Webbplats</label>
          <input
            id="gp-link"
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.erabolag.se"
          />
        </div>
        <div className="field">
          <label htmlFor="gp-contact">Kontaktmejl</label>
          <input
            id="gp-contact"
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="info@erabolag.se"
          />
        </div>
      </div>

      <div className="field">
        <label className="checkbox-row" htmlFor="gp-ka">
          <input id="gp-ka" type="checkbox" checked={ka} onChange={(e) => setKa(e.target.checked)} />
          Vi har kollektivavtal
        </label>
        <p className="hint">
          Visas som en faktauppgift på er profil. Kunder väljer leverantör bland annat utifrån det,
          så kryssa bara i om det stämmer.
        </p>
      </div>

      <ImageUploadField
        label="Logotyp"
        value={logo}
        onChange={setLogo}
        companyId={company.id}
        folder="logo"
        shape="square"
      />

      {status === "error" && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
      {status === "sparat" && (
        <p style={{ color: "var(--color-success)", fontSize: 13 }}>
          Sparat. Ändringarna syns på er profil inom några minuter.
        </p>
      )}

      <button className="qs-btn" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Sparar..." : "Spara"}
      </button>
    </form>
  );
}
