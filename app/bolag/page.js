"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { FILTER_DEFS, AREA_TO_BRANSCH } from "@/lib/taxonomy";
import { empNum, allRegionCities } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

const CITY_OPTIONS = allRegionCities();

function matchesFocus(c, area) {
  const branschTags = AREA_TO_BRANSCH[area] || [];
  if (!branschTags.length) return false;
  return c.focus.some((f) => branschTags.includes(f));
}

function auktorisationCategory(c) {
  const hasBemanning = c.auktorisation.includes("Bemanning");
  const hasRekrytering = c.auktorisation.includes("Rekrytering");
  if (hasBemanning && hasRekrytering) return "Både och";
  if (hasBemanning) return "Bemanning";
  if (hasRekrytering) return "Rekrytering";
  return "Inget av ovanstående";
}

function BolagContent() {
  const searchParams = useSearchParams();
  const initialFocus = searchParams.get("fokus");

  const [city, setCity] = useState("");
  const [focus, setFocus] = useState(() => (initialFocus ? initialFocus.split(",")[0] : ""));
  const [service, setService] = useState("");
  const [sizeBand, setSizeBand] = useState("");
  const [ka, setKa] = useState("");
  const [auktorisation, setAuktorisation] = useState("");
  const [sort, setSort] = useState("name");

  function resetFilters() {
    setCity("");
    setFocus("");
    setService("");
    setSizeBand("");
    setKa("");
    setAuktorisation("");
  }

  const list = useMemo(() => {
    const filtered = COMPANIES.filter((c) => {
      if (city && c.city !== city) return false;
      if (focus && !matchesFocus(c, focus)) return false;
      if (service && !c.services.includes(service)) return false;
      if (sizeBand && c.sizeBand !== sizeBand) return false;
      if (ka === "ja" && !c.ka) return false;
      if (ka === "nej" && c.ka) return false;
      if (auktorisation && auktorisationCategory(c) !== auktorisation) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "employees") sorted.sort((a, b) => empNum(b) - empNum(a));
    else if (sort === "founded") sorted.sort((a, b) => a.founded - b.founded);
    else sorted.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    return sorted;
  }, [city, focus, service, sizeBand, ka, auktorisation, sort]);

  return (
    <div id="view-home">
      <section className="hero">
        <div>
          <div className="eyebrow">Prototyp — klickbar demo · uppdaterad med verkliga bolag</div>
          <h1 className="hero-title">
            Bemannings- och
            <br />
            rekryteringsbolag <em>i Sverige</em>.
          </h1>
          <p className="hero-sub">
            Här ser du samtliga bemannings- och rekryteringsföretag som är verksamma inom produktion, lager, logistik
            och verkstad i Sverige. Filtrera fram de som matchar era villkor och behov — och gå vidare direkt
            med rätt partner.
          </p>
          <p className="hero-note">
            Notera: Aditro Logistics bytte namn till Posti 2024 efter det finska bolagets förvärv 2020 — de listas
            darför som ett och samma bolag nedan.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">20</span><span className="label">Bolag i registret</span></div>
            <div className="stat"><span className="num">{FILTER_DEFS.focus.options.length}</span><span className="label">Fokusområden</span></div>
            <div className="stat"><span className="num">1</span><span className="label">Region: Sverige</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <div className="filter-title">Filtrering &amp; Segmentering</div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-city">Stad</label>
              <select id="f-city" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">Alla städer</option>
                {CITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-focus">{FILTER_DEFS.focus.label}</label>
              <select id="f-focus" value={focus} onChange={(e) => setFocus(e.target.value)}>
                <option value="">Alla branscher</option>
                {FILTER_DEFS.focus.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-service">{FILTER_DEFS.service.label}</label>
              <select id="f-service" value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Alla tjänster</option>
                {FILTER_DEFS.service.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-size">{FILTER_DEFS.sizeBand.label}</label>
              <select id="f-size" value={sizeBand} onChange={(e) => setSizeBand(e.target.value)}>
                <option value="">Alla storlekar</option>
                {FILTER_DEFS.sizeBand.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-ka">Kollektivavtal</label>
              <select id="f-ka" value={ka} onChange={(e) => setKa(e.target.value)}>
                <option value="">Alla</option>
                <option value="ja">Har kollektivavtal</option>
                <option value="nej">Har inte kollektivavtal</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-auk">Auktorisation</label>
              <select id="f-auk" value={auktorisation} onChange={(e) => setAuktorisation(e.target.value)}>
                <option value="">Alla</option>
                <option value="Bemanning">Bemanning</option>
                <option value="Rekrytering">Rekrytering</option>
                <option value="Både och">Både och</option>
                <option value="Inget av ovanstående">Inget av ovanstående</option>
              </select>
            </div>
          </div>
          <button className="reset-btn" onClick={resetFilters}>Rensa alla filter</button>
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px 40px" }}>
        <div className="results-bar">
          <div className="results-count"><b>{list.length}</b> bolag matchar dina filter</div>
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Sortera: Namn A–Ö</option>
            <option value="employees">Sortera: Flest medarbetare</option>
            <option value="founded">Sortera: Äldst etablerat</option>
          </select>
        </div>
        <div className="grid">
          {list.length === 0 ? (
            <div className="empty-note" style={{ gridColumn: "1/-1" }}>Inga bolag matchar just nu — testa att rensa något filter.</div>
          ) : (
            list.map((c) => <CompanyCard company={c} key={c.id} />)
          )}
        </div>
      </div>

      <div className="disclaimer">
        <b>Om datan:</b> Omsättning, antal medarbetare, adress och etableringsår är hämtade från offentliga källor
        (Bolagsverket via Allabolag/Ratsit/Bolagsfakta/hitta.se) samt respektive bolags egna webbplatser, kontrollerade
        i juli 2026. Där bolagens årsredovisning för 2025 ännu inte var tillgänglig visas senaste rapporterade år
        (2024) istället — detta anges vid varje bolag. Vissa siffror avser koncernnivå snarare än den enskilda
        juridiska person som är verksam i Sverige. Uppgifterna bör verifieras direkt mot bolagen innan de
        används i skarpt beslutsunderlag.
      </div>
    </div>
  );
}

export default function BolagPage() {
  return (
    <Suspense fallback={null}>
      <BolagContent />
    </Suspense>
  );
}
