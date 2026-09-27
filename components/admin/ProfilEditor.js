"use client";

import { useMemo, useState } from "react";
import { YRKESOMRADEN, TJANSTER } from "@/lib/taxonomy";
import MultiSelectField from "@/components/MultiSelectField";
import ImageUploadField from "@/components/admin/ImageUploadField";
import BildspelField from "@/components/admin/BildspelField";
import AdressField from "@/components/admin/AdressField";
import TjanstInfo from "@/components/TjanstInfo";
import { ISO_CERTIFIERINGAR } from "@/lib/iso";

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
  const [iso, setIso] = useState(company.iso_certifications || []);
  const [slideshow, setSlideshow] = useState(company.slideshow || []);
  const [addresses, setAddresses] = useState(company.addresses || []);

  // Nyckeltalen kom ur Bolagsverket och årsredovisningar och var låsta. De är
  // bolagets egna nu — omsättningen i registret är ofta räkenskapsåret 2024, och
  // den som tar över sin profil ska kunna skriva dit årets siffra och tala om
  // vilket år den gäller.
  const egna = company.company_key_figures || {};
  const [revenue, setRevenue] = useState(egna.revenue || "");
  const [revenueYear, setRevenueYear] = useState(egna.revenue_year ?? "");
  const [employees, setEmployees] = useState(egna.employees || "");
  const [employeesYear, setEmployeesYear] = useState(egna.employees_year ?? "");
  const [founded, setFounded] = useState(egna.founded ?? "");

  const [customerScore, setCustomerScore] = useState(
    company.surveys?.customer_satisfaction?.score ?? ""
  );
  const [customerSource, setCustomerSource] = useState(
    company.surveys?.customer_satisfaction?.source ?? ""
  );
  const [customerYear, setCustomerYear] = useState(
    company.surveys?.customer_satisfaction?.year ?? ""
  );
  const [employeeScore, setEmployeeScore] = useState(
    company.surveys?.employee_satisfaction?.score ?? ""
  );
  const [employeeSource, setEmployeeSource] = useState(
    company.surveys?.employee_satisfaction?.source ?? ""
  );
  const [employeeYear, setEmployeeYear] = useState(
    company.surveys?.employee_satisfaction?.year ?? ""
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

  function surveyEntry(score, year, source) {
    if (score === "" || score === null) return null;
    return { score: Number(score), year: Number(year), source: source.trim() };
  }

  const iAr = new Date().getFullYear();

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

    // Samma skäl som för postorten: routen avvisar ett betyg utan giltigt år,
    // men utan att säga vilket fält det gäller. Äldre mätningar sparades utan
    // år och fångas här första gången bolaget sparar igen.
    const utanAr = [
      ["Kundnöjdhet", customerScore, customerYear],
      ["Medarbetarnöjdhet", employeeScore, employeeYear],
    ].find(([, betyg, ar]) => betyg !== "" && !(Number.isInteger(Number(ar)) && ar >= 2000 && ar <= iAr));
    if (utanAr) {
      setStatus("error");
      setError(`${utanAr[0]} saknar årtal. Ange vilket år mätningen gjordes (2000–${iAr}).`);
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
        iso,
        slideshow,
        addresses,
        // Tomma fält skickas som null och inte som "", så att en rensad siffra
        // blir tom i registret i stället för en tom sträng som ser ut som ett
        // värde när profilen renderas.
        revenue: revenue.trim() || null,
        revenueYear: revenueYear === "" ? null : Number(revenueYear),
        employees: employees.trim() || null,
        employeesYear: employeesYear === "" ? null : Number(employeesYear),
        founded: founded === "" ? null : Number(founded),
        surveys: {
          customer_satisfaction: surveyEntry(customerScore, customerYear, customerSource),
          employee_satisfaction: surveyEntry(employeeScore, employeeYear, employeeSource),
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
          leverantör. Även nyckeltalen: de kom från Bolagsverket och årsredovisningar, men är era
          att uppdatera nu. Profilen visar vad ni ändrat och när — det är så en siffra ni skrivit
          själva ändå går att jämföra med en hämtad ur en årsredovisning. Organisationsnummer och
          bolagsnamn ändrar vi åt er; hör av er så gör vi det.
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
          <label htmlFor="gp-services" className="med-info">
            Tjänster
            <TjanstInfo malgrupp="bolag" />
          </label>
          <MultiSelectField
            id="gp-services"
            options={TJANSTER}
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
        <div className="filter-title">Nyckeltal</div>
        <p className="hint" style={{ marginTop: 0 }}>
          Siffrorna nedan kommer från Bolagsverket och årsredovisningar och är ofta ett par år gamla.
          Skriv era egna så visas de överst på profilen — registrets tal står kvar under, mindre, som
          jämförelse. Ange vilket år er siffra gäller; det är året som gör den jämförbar. Lämnar ni
          ett fält tomt visas bara registrets tal.
        </p>
        <div className="profil-rad">
          <div className="field">
            <label htmlFor="gp-revenue">Omsättning</label>
            <input
              id="gp-revenue"
              type="text"
              maxLength={60}
              value={revenue}
              placeholder="t.ex. 221,2 Mkr"
              onChange={(e) => setRevenue(e.target.value)}
            />
            <p className="hint">
              {company.revenue
                ? `Registret: ${company.revenue}${company.revenue_year ? ` (${company.revenue_year})` : ""}. `
                : "Registret saknar omsättning för er. "}
              Skriv som ni brukar — &quot;18,4 Mkr&quot; eller &quot;1 997 Mkr (koncern)&quot;.
            </p>
          </div>
          <div className="field">
            <label htmlFor="gp-revenue-year">Räkenskapsår</label>
            <input
              id="gp-revenue-year"
              type="number"
              min="1800"
              max={new Date().getFullYear() + 1}
              value={revenueYear}
              placeholder="t.ex. 2025"
              onChange={(e) => setRevenueYear(e.target.value)}
            />
          </div>
        </div>
        <div className="profil-rad">
          <div className="field">
            <label htmlFor="gp-employees">Medarbetare</label>
            <input
              id="gp-employees"
              type="text"
              maxLength={60}
              value={employees}
              placeholder="t.ex. 301"
              onChange={(e) => setEmployees(e.target.value)}
            />
            <p className="hint">
              {company.employees
                ? `Registret: ${company.employees}${company.employees_year ? ` (${company.employees_year})` : ""}.`
                : "Registret saknar antal medarbetare för er."}
            </p>
          </div>
          <div className="field">
            <label htmlFor="gp-employees-year">Räkenskapsår</label>
            <input
              id="gp-employees-year"
              type="number"
              min="1800"
              max={new Date().getFullYear() + 1}
              value={employeesYear}
              placeholder="t.ex. 2025"
              onChange={(e) => setEmployeesYear(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gp-founded">Grundat</label>
          <input
            id="gp-founded"
            type="number"
            min="1800"
            max={new Date().getFullYear() + 1}
            value={founded}
            placeholder="t.ex. 1998"
            onChange={(e) => setFounded(e.target.value)}
          />
          <p className="hint">
            {company.founded ? `Registret: ${company.founded}. ` : ""}
            Registreringsåret hos Bolagsverket. Har verksamheten äldre rötter än bolaget är det er
            historia som är den riktiga — skriv den.
          </p>
        </div>
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

      <div className="auth-panel" style={{ marginTop: 20 }}>
        <div className="filter-title">ISO-certifieringar</div>
        <div className="field">
          {ISO_CERTIFIERINGAR.map((c) => {
            const id = `gp-iso-${c.kod.replace(/\D/g, "")}`;
            return (
              <label className="checkbox-row" htmlFor={id} key={c.kod}>
                <input
                  id={id}
                  type="checkbox"
                  checked={iso.includes(c.kod)}
                  onChange={(e) =>
                    setIso((nu) =>
                      e.target.checked ? [...nu, c.kod] : nu.filter((k) => k !== c.kod)
                    )
                  }
                />
                {c.kod} – {c.namn}
              </label>
            );
          })}
          <p className="hint">
            Visas på er profil bara om ni har minst en av dem. Kryssa bara i certifieringar ni
            innehar i dag.
          </p>
        </div>
      </div>

      <div className="profil-rad">
      <div className="auth-panel">
        <div className="filter-title">Undersökningar</div>
        <p style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 0 }}>
          Egna mätningar visas med årtal och källa bredvid siffran, så att den som läser kan
          bedöma vad betyget är värt. Lämna tomt om ni inte mäter.
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
            <label htmlFor="gp-customer-year">År</label>
            <input
              id="gp-customer-year"
              type="number"
              min="2000"
              max={iAr}
              step="1"
              placeholder={String(iAr)}
              required={customerScore !== ""}
              value={customerYear}
              onChange={(e) => setCustomerYear(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="gp-customer-source">Källa</label>
            <input
              id="gp-customer-source"
              type="text"
              placeholder="T.ex. egen kundundersökning"
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
            <label htmlFor="gp-employee-year">År</label>
            <input
              id="gp-employee-year"
              type="number"
              min="2000"
              max={iAr}
              step="1"
              placeholder={String(iAr)}
              required={employeeScore !== ""}
              value={employeeYear}
              onChange={(e) => setEmployeeYear(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="gp-employee-source">Källa</label>
            <input
              id="gp-employee-source"
              type="text"
              placeholder="T.ex. medarbetarundersökning"
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
