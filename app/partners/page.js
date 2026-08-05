"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { YRKESOMRADEN, REGION_MAP, FILTER_DEFS } from "@/lib/taxonomy";
import { citiesForRegion } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

export default function PartnersPage() {
  const router = useRouter();
  const [omrade, setOmrade] = useState("");
  const [service, setService] = useState("");
  const [sokroll, setSokroll] = useState("");
  const [region, setRegion] = useState("");
  const [ort, setOrt] = useState("");
  const [requireKa, setRequireKa] = useState(false);
  const [requireAuktorisation, setRequireAuktorisation] = useState(false);

  const cities = useMemo(() => citiesForRegion(region), [region]);

  const topRated = useMemo(
    () =>
      [...COMPANIES]
        .filter((c) => c.rating)
        .sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount || a.name.localeCompare(b.name, "sv"))
        .slice(0, 6),
    []
  );

  function handleRegionChange(e) {
    setRegion(e.target.value);
    setOrt("");
  }

  function handleSearch() {
    const params = new URLSearchParams();
    if (omrade) params.set("omrade", omrade);
    if (service) params.set("tjanst", service);
    if (sokroll.trim()) params.set("sokroll", sokroll.trim());
    if (ort) params.set("ort", ort);
    if (requireKa) params.set("ka", "1");
    if (requireAuktorisation) params.set("auk", "1");
    router.push(`/partners/resultat?${params.toString()}`);
  }

  return (
    <div id="view-partners">
      <section className="hero" style={{ minHeight: "calc(100vh - 160px)", alignContent: "center" }}>
        <div>
          <div className="eyebrow">Hitta partners · Sverige</div>
          <h1 className="hero-title">Partners</h1>
          <p className="hero-sub">
            Ange yrkesområde, tjänst och län/ort så visar vi bemannings- och rekryteringsbolagen i Sverige
            rangordnade efter relevans för just era behov.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">{COMPANIES.length}</span><span className="label">Bolag i registret</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <p>Filtrera på yrkesområde, tjänst och ort.</p>
          <div className="field-row">
            <div className="field">
              <label htmlFor="pt-omrade">Yrkesområde</label>
              <select id="pt-omrade" value={omrade} onChange={(e) => setOmrade(e.target.value)}>
                <option value="">Alla yrkesområden</option>
                {Object.keys(YRKESOMRADEN).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pt-service">Tjänst</label>
              <select id="pt-service" value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">Alla tjänster</option>
                {FILTER_DEFS.service.options.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="pt-sokroll">Vad vill ni rekrytera till? (valfritt)</label>
            <input
              id="pt-sokroll"
              type="text"
              placeholder="T.ex. aluminiumsvetsare"
              value={sokroll}
              onChange={(e) => setSokroll(e.target.value)}
              maxLength={45}
            />
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
          <div className="field">
            <label>Krav (valfritt)</label>
            <label className="checkbox-row">
              <input type="checkbox" checked={requireKa} onChange={(e) => setRequireKa(e.target.checked)} />
              Kollektivavtal
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={requireAuktorisation}
                onChange={(e) => setRequireAuktorisation(e.target.checked)}
              />
              Auktoriserat bolag
            </label>
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
