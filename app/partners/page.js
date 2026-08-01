"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { YRKESOMRADEN, REGION_MAP } from "@/lib/taxonomy";
import { rolesForArea, citiesForRegion } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

export default function PartnersPage() {
  const router = useRouter();
  const [omrade, setOmrade] = useState("");
  const [yrke, setYrke] = useState("");
  const [region, setRegion] = useState("");
  const [ort, setOrt] = useState("");

  const roles = useMemo(() => rolesForArea(omrade), [omrade]);
  const cities = useMemo(() => citiesForRegion(region), [region]);

  const topRated = useMemo(
    () =>
      [...COMPANIES]
        .filter((c) => c.rating)
        .sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount || a.name.localeCompare(b.name, "sv"))
        .slice(0, 6),
    []
  );

  function handleOmradeChange(e) {
    setOmrade(e.target.value);
    setYrke("");
  }
  function handleRegionChange(e) {
    setRegion(e.target.value);
    setOrt("");
  }

  function handleSearch() {
    const params = new URLSearchParams();
    if (omrade) params.set("omrade", omrade);
    if (ort) params.set("ort", ort);
    router.push(`/partners/resultat?${params.toString()}`);
  }

  return (
    <div id="view-partners">
      <section className="hero" style={{ minHeight: "calc(100vh - 160px)", alignContent: "center" }}>
        <div>
          <div className="eyebrow">Hitta partners · Sverige</div>
          <h1 className="hero-title">Partners</h1>
          <p className="hero-sub">
            Ange yrkesområde/yrke och län/ort så visar vi bemannings- och rekryteringsbolagen i Sverige
            rangordnade efter relevans för just era behov.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">20</span><span className="label">Bolag i registret</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <p>Filtrera på yrke och ort.</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pt-omrade">Yrkesområde</label>
              <select id="pt-omrade" value={omrade} onChange={handleOmradeChange}>
                <option value="">Alla yrkesområden</option>
                {Object.keys(YRKESOMRADEN).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pt-yrke">Yrke</label>
              <select id="pt-yrke" value={yrke} onChange={(e) => setYrke(e.target.value)}>
                <option value="">Alla yrken</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pt-region">Län</label>
              <select id="pt-region" value={region} onChange={handleRegionChange}>
                <option value="">Alla län</option>
                {Object.keys(REGION_MAP).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pt-ort">Ort</label>
              <select id="pt-ort" value={ort} onChange={(e) => setOrt(e.target.value)}>
                <option value="">Alla orter</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="qs-btn" onClick={handleSearch}>Hitta bolag &rarr;</button>
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-kicker">Bäst rankade · Google-betyg</div>
        <h2>Topprankade partners</h2>
        <p className="l-section-sub">Sex av registrets högst rankade bolag enligt Google-recensioner.</p>
        <div className="grid">
          {topRated.map((c) => (
            <CompanyCard company={c} key={c.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
