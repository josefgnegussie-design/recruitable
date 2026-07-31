"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { FILTER_DEFS } from "@/lib/taxonomy";
import { empNum } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

const QUICK_CHIPS = ["Produktion", "Lager", "Logistik", "Verkstad"];

function BolagContent() {
  const searchParams = useSearchParams();
  const initialFocus = searchParams.get("fokus");

  const [focus, setFocus] = useState(() => new Set(initialFocus ? initialFocus.split(",") : []));
  const [service, setService] = useState(() => new Set());
  const [sizeBand, setSizeBand] = useState(() => new Set());
  const [kaOnly, setKaOnly] = useState(false);
  const [sort, setSort] = useState("name");

  function toggleSetValue(setter) {
    return (val) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        return next;
      });
    };
  }
  const toggleFocus = toggleSetValue(setFocus);
  const toggleService = toggleSetValue(setService);
  const toggleSizeBand = toggleSetValue(setSizeBand);

  function resetFilters() {
    setFocus(new Set());
    setService(new Set());
    setSizeBand(new Set());
    setKaOnly(false);
  }

  const list = useMemo(() => {
    const filtered = COMPANIES.filter((c) => {
      if (focus.size && !c.focus.some((f) => focus.has(f))) return false;
      if (service.size && !c.services.some((s) => service.has(s))) return false;
      if (sizeBand.size && !sizeBand.has(c.sizeBand)) return false;
      if (kaOnly && !c.ka) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "employees") sorted.sort((a, b) => empNum(b) - empNum(a));
    else if (sort === "founded") sorted.sort((a, b) => a.founded - b.founded);
    else sorted.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    return sorted;
  }, [focus, service, sizeBand, kaOnly, sort]);

  return (
    <div id="view-home">
      <section className="hero">
        <div>
          <div className="eyebrow">Prototyp — klickbar demo · uppdaterad med verkliga bolag</div>
          <h1 className="hero-title">
            Bemannings- och
            <br />
            rekryteringsbolag <em>i Västra Götaland</em>.
          </h1>
          <p className="hero-sub">
            Här ser du samtliga bemannings- och rekryteringsföretag som är verksamma inom produktion, lager, logistik
            och verkstad i Västra Götaland. Filtrera fram de som matchar era villkor och behov — och gå vidare direkt
            med rätt partner.
          </p>
          <p className="hero-note">
            Notera: Aditro Logistics bytte namn till Posti 2024 efter det finska bolagets förvärv 2020 — de listas
            darför som ett och samma bolag nedan.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">20</span><span className="label">Bolag i registret</span></div>
            <div className="stat"><span className="num">4</span><span className="label">Fokusområden</span></div>
            <div className="stat"><span className="num">1</span><span className="label">Region: Västra Götaland</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <p>Testa filtret direkt — resultatet nedan uppdateras live.</p>
          <div className="chip-row">
            {QUICK_CHIPS.map((q) => (
              <button key={q} className={`chip ${focus.has(q) ? "on" : ""}`} onClick={() => toggleFocus(q)}>{q}</button>
            ))}
          </div>
        </div>
      </section>

      <main>
        <aside className="filters">
          <h3>Filtrera</h3>
          <div className="filter-group">
            <h4>{FILTER_DEFS.focus.label}</h4>
            {FILTER_DEFS.focus.options.map((opt) => (
              <div className="fcheck" key={opt} onClick={() => toggleFocus(opt)}>
                <div className={`box ${focus.has(opt) ? "checked" : ""}`}></div>{opt}
              </div>
            ))}
          </div>
          <div className="filter-group">
            <h4>{FILTER_DEFS.service.label}</h4>
            {FILTER_DEFS.service.options.map((opt) => (
              <div className="fcheck" key={opt} onClick={() => toggleService(opt)}>
                <div className={`box ${service.has(opt) ? "checked" : ""}`}></div>{opt}
              </div>
            ))}
          </div>
          <div className="filter-group">
            <h4>{FILTER_DEFS.sizeBand.label}</h4>
            {FILTER_DEFS.sizeBand.options.map((opt) => (
              <div className="fcheck" key={opt} onClick={() => toggleSizeBand(opt)}>
                <div className={`box ${sizeBand.has(opt) ? "checked" : ""}`}></div>{opt}
              </div>
            ))}
          </div>
          <div className="filter-group">
            <h4>Villkor</h4>
            <div className="fcheck" onClick={() => setKaOnly((v) => !v)}>
              <div className={`box ${kaOnly ? "checked" : ""}`}></div>Har kollektivavtal
            </div>
          </div>
          <button className="reset-btn" onClick={resetFilters}>Rensa alla filter</button>
        </aside>
        <section>
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
        </section>
      </main>

      <div className="disclaimer">
        <b>Om datan:</b> Omsättning, antal medarbetare, adress och etableringsår är hämtade från offentliga källor
        (Bolagsverket via Allabolag/Ratsit/Bolagsfakta/hitta.se) samt respektive bolags egna webbplatser, kontrollerade
        i juli 2026. Där bolagens årsredovisning för 2025 ännu inte var tillgänglig visas senaste rapporterade år
        (2024) istället — detta anges vid varje bolag. Vissa siffror avser koncernnivå snarare än den enskilda
        juridiska person som är verksam i Västra Götaland. Uppgifterna bör verifieras direkt mot bolagen innan de
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
