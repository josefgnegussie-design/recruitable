"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { YRKESOMRADEN, FILTER_DEFS } from "@/lib/taxonomy";
import { allRegionCities } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

function SokContent({ antalBolag, urval }) {
  // urval kommer färdigblandat från servern — sex bolag, inget mer.
  const router = useRouter();
  const searchParams = useSearchParams();

  // Samma parametrar som skickas vidare till resultatsidan läses tillbaka här, så
  // att "Tillbaka till filtret" visar det besökaren redan fyllt i istället för ett
  // tomt formulär.
  const [beskrivning, setBeskrivning] = useState(() => searchParams.get("beskrivning") || "");
  const [omrade, setOmrade] = useState(() => searchParams.get("omrade") || "");
  const [service, setService] = useState(() => searchParams.get("tjanst") || "");
  const [ort, setOrt] = useState(() => searchParams.get("ort") || "");
  const [error, setError] = useState("");

  const cities = useMemo(() => allRegionCities(), []);

  function handleSearch() {
    if (!beskrivning.trim()) {
      setError("Beskriv kortfattat vad ni söker.");
      return;
    }
    setError("");

    const params = new URLSearchParams();
    params.set("beskrivning", beskrivning.trim());
    if (omrade) params.set("omrade", omrade);
    if (service) params.set("tjanst", service);
    if (ort) params.set("ort", ort);
    router.push(`/rekrytera/resultat?${params.toString()}`);
  }

  return (
    <div id="view-rekrytera">
      <section className="hero" style={{ minHeight: "calc(100vh - 160px)", alignContent: "center" }}>
        <div>
          <div className="eyebrow">Hitta partners · Sverige</div>
          <h1 className="hero-title">Rekrytera</h1>
          <p className="hero-sub">
            Ange ort och yrkesområde så visar vi bemannings- och rekryteringsbolagen i Sverige rangordnade
            efter relevans för just era behov.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">{antalBolag}</span><span className="label">Bolag i registret</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <p>Välj ort och yrkesområde, beskriv sedan ert behov och filtrera på tjänst.</p>
          <div className="field">
            <label htmlFor="pt-ort">Ort</label>
            <input
              id="pt-ort"
              type="text"
              list="pt-ort-list"
              placeholder="Alla orter"
              value={ort}
              onChange={(e) => setOrt(e.target.value)}
              autoComplete="off"
            />
            <datalist id="pt-ort-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
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
            <label htmlFor="pt-beskrivning">Beskriv ert behov</label>
            <textarea
              id="pt-beskrivning"
              value={beskrivning}
              onChange={(e) => setBeskrivning(e.target.value.slice(0, 350))}
              maxLength={350}
              rows={4}
              placeholder="T.ex. roll, omfattning, önskad start och annat som är bra för bolagen att veta."
            />
            <div className="char-counter">{beskrivning.length}/350 tecken</div>
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
          {error && <p style={{ color: "#c0392b", fontSize: 13 }}>{error}</p>}
          <button className="qs-btn" onClick={handleSearch}>Hitta bolag &rarr;</button>
        </div>
      </section>

      <section className="l-section tight">
        <h2>Urval av bolag</h2>
        <div className="grid">
          {urval.map((c) => (
            <CompanyCard company={c} key={c.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function RekryteraSok(props) {
  return (
    <Suspense fallback={null}>
      <SokContent {...props} />
    </Suspense>
  );
}
