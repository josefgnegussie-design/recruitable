"use client";

import { useMemo, useState } from "react";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import MultiSelectField from "@/components/MultiSelectField";
import ImageUploadField from "@/components/admin/ImageUploadField";
import BildspelField from "@/components/admin/BildspelField";
import AdressField from "@/components/admin/AdressField";

const SERVICE_OPTIONS = ["Bemanning", "Rekrytering", "Interim", "Search"];

// Bolagets hela profil i ett formulär. Låg tidigare i två: GrundprofilEditor i
// 900 px-panelen och ProfileEditor i en egen 720 px-spalt med egen rubrik och
// egen Spara-knapp under den — två sidor limmade på varandra, med logotypfältet
// dubblerat i båda. Ingenting här är låst bakom premium: fälten är det kunden
// väljer leverantör utifrån, så en tom profil kostar registret mer än den ger.
export default function ProfilEditor({ company }) {
  const [logo, setLogo] = useState(company.logo || "");
  const [vision, setVision] = useState(company.vision || "");
  const [description, setDescription] = useState(company.description || "");
  const [services, setServices] = useState(company.services || []);
  const [focus, setFocus] = useState(company.focus || []);
  const [roles, setRoles] = useState(company.recruiting_roles || []);
  const [link, setLink] = useState(company.link || "");
  const [contact, setContact] = useState(company.contact || "");
  const [ka, setKa] = useState(Boolean(company.ka));
  const [slideshow, setSlideshow] = useState(company.slideshow || []);
  const [addresses, setAddresses] = useState(company.addresses || []);

  const [customerScore, setCustomerScore] = useState(
    company.surveys?.customer_satisfaction?.score ?? ""
  );
  const [customerSource, setCustomerSource] = useState(
    company.surveys?.customer_satisfaction?.source ?? ""
  );
  const [employeeScore, setEmployeeScore] = useState(
    company.surveys?.employee_satisfaction?.score ?? ""
  );
  const [employeeSource, setEmployeeSource] = useState(
    company.surveys?.employee_satisfaction?.source ?? ""
  );

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Yrkesrollerna som erbjuds följer de valda yrkesområdena. Hela taxonomin är
  // drygt 700 roller — utan den avgränsningen blir listan obrukbar, och en roll
  // vald ur ett område bolaget inte rekryterar inom vore ändå motsägelsefull.
  const roleOptions = useMemo(() => {
    const areas = focus.length ? focus : Object.keys(YRKESOMRADEN);
    return [...new Set(areas.flatMap((a) => YRKESOMRADEN[a] || []))].sort((a, b) =>
      a.localeCompare(b, "sv")
    );
  }, [focus]);

  // Tas ett yrkesområde bort ska dess roller inte ligga kvar osynliga i
  // registret. De rensas här och inte vid sparning, så att den som redigerar ser
  // vad valet innebar.
  function handleFocusChange(next) {
    setFocus(next);
    const kvar = new Set(
      (next.length ? next : Object.keys(YRKESOMRADEN)).flatMap((a) => YRKESOMRADEN[a] || [])
    );
    setRoles((prev) => prev.filter((r) => kvar.has(r)));
  }

  function surveyEntry(score, source) {
    if (score === "" || score === null) return null;
    return { score: Number(score), source: source.trim() };
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Routen avvisar adresser utan postort, men med ett allmänt
    // "ofullständig eller ogiltig förfrågan" som inte säger vilket fält som
    // fattas. Det här beskedet pekar ut raden.
    const utanOrt = addresses.findIndex((a) => !(a.city || "").trim());
    if (utanOrt >= 0) {
      setStatus("error");
      setError(`Adress ${utanOrt + 1} saknar postort. Fyll i den eller ta bort raden.`);
      return;
    }

    setStatus("loading");
    setError("");

    const res = await fetch("/api/profil/grunduppgifter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        logo,
        vision,
        description,
        services,
        focus,
        recruitingRoles: roles,
        link,
        contact,
        ka,
        slideshow,
        addresses,
        surveys: {
          customer_satisfaction: surveyEntry(customerScore, customerSource),
          employee_satisfaction: surveyEntry(employeeScore, employeeSource),
        },
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
    <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      <div className="auth-panel">
        <h3 style={{ marginTop: 0 }}>Er profil</h3>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 0 }}>
          Det här är uppgifterna ni själva svarar för, och allt här syns för den som söker
          leverantör. Omsättning, antal anställda, adress och organisationsnummer hämtas från
          Bolagsverket och årsredovisningar och går inte att ändra — det är den grunden som gör
          registret jämförbart.
        </p>
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Logotyp</div>
        <ImageUploadField
          label="Logotyp"
          value={logo}
          onChange={setLogo}
          companyId={company.id}
          folder="logo"
          shape="square"
        />
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Presentation</div>
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
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Inriktning</div>
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
        <div className="field">
          <label htmlFor="gp-focus">Yrkesområden ni rekryterar inom</label>
          <MultiSelectField
            id="gp-focus"
            options={Object.keys(YRKESOMRADEN)}
            selected={focus}
            onChange={handleFocusChange}
            placeholder="Välj yrkesområden..."
          />
        </div>
        <div className="field">
          <label htmlFor="gp-roles">Yrkesroller</label>
          <MultiSelectField
            id="gp-roles"
            options={roleOptions}
            selected={roles}
            onChange={setRoles}
            placeholder="Välj yrkesroller..."
          />
          <p className="hint">
            {focus.length
              ? "Rollerna följer de yrkesområden ni valt ovan. Den som söker en särskild roll ser vilka bolag som faktiskt rekryterar den."
              : "Välj yrkesområden ovan först — då kortas listan ner till rollerna inom dem."}
          </p>
        </div>
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Kontakt</div>
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
            <p className="hint">Hit går förfrågningar som inte matchar något av era betalda kontor.</p>
          </div>
        </div>
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Adresser</div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
          Var ni finns. Postorterna visas i sökresultatet, så den som letar leverantör på sin egen
          ort hittar er. Kostar ingenting och är inte begränsat till era betalda kontor.
        </p>
        <AdressField value={addresses} onChange={setAddresses} />
      </div>

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">Kollektivavtal</div>
        <div className="field">
          <label className="checkbox-row" htmlFor="gp-ka">
            <input id="gp-ka" type="checkbox" checked={ka} onChange={(e) => setKa(e.target.checked)} />
            Vi har kollektivavtal
          </label>
          <p className="hint">
            Visas som en faktauppgift på er profil. Kunder väljer leverantör bland annat utifrån
            det, så kryssa bara i om det stämmer.
          </p>
        </div>
      </div>

      <div className="profil-rad">
      <div className="auth-panel">
        <div className="filter-title">Undersökningar</div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
          Egna mätningar visas med källa bredvid siffran, så att den som läser kan bedöma vad
          betyget är värt. Lämna tomt om ni inte mäter.
        </p>
        <div className="survey-row">
          <div>
            <label htmlFor="gp-customer-score">Kundnöjdhet (1–5)</label>
            <input
              id="gp-customer-score"
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={customerScore}
              onChange={(e) => setCustomerScore(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="gp-customer-source">Källa</label>
            <input
              id="gp-customer-source"
              type="text"
              placeholder="T.ex. egen kundundersökning, hösten 2026"
              value={customerSource}
              onChange={(e) => setCustomerSource(e.target.value)}
            />
          </div>
        </div>
        <div className="survey-row">
          <div>
            <label htmlFor="gp-employee-score">Medarbetarnöjdhet (1–5)</label>
            <input
              id="gp-employee-score"
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={employeeScore}
              onChange={(e) => setEmployeeScore(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="gp-employee-source">Källa</label>
            <input
              id="gp-employee-source"
              type="text"
              placeholder="T.ex. medarbetarundersökning, våren 2026"
              value={employeeSource}
              onChange={(e) => setEmployeeSource(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="filter-title">Bildspel</div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
          Bilder från verksamheten. De säger ofta mer om hur det är att arbeta med er än en text
          gör.
        </p>
        <BildspelField companyId={company.id} value={slideshow} onChange={setSlideshow} />
      </div>
      </div>

      {status === "error" && (
        <p style={{ color: "var(--color-error)", fontSize: 13, marginTop: 16 }}>{error}</p>
      )}
      {status === "sparat" && (
        <p style={{ color: "var(--color-success)", fontSize: 13, marginTop: 16 }}>
          Sparat. Ändringarna syns på er profil inom några minuter.
        </p>
      )}

      <button className="qs-btn" type="submit" disabled={status === "loading"} style={{ marginTop: 20 }}>
        {status === "loading" ? "Sparar..." : "Spara"}
      </button>
    </form>
  );
}
