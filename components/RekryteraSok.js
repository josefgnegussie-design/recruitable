"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { YRKESOMRADEN, FILTER_DEFS } from "@/lib/taxonomy";
import { allRegionCities } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";
import TjanstInfo from "@/components/TjanstInfo";
import { markeraFranTraffar } from "@/lib/franTraffar";

// Fångar klick på profillänkarna i korten, så att profilens tillbakalänk vet
// att den kan gå bakåt i historiken i stället för till en tom sökning.
function vidKortklick(e) {
  const lank = e.target.closest?.('a[href^="/bolag/"]');
  if (lank) markeraFranTraffar(new URL(lank.href).pathname);
}

export default function RekryteraSok({ antalBolag, urval }) {
  // urval kommer färdigblandat från servern — sex bolag, inget mer.
  const router = useRouter();

  const [beskrivning, setBeskrivning] = useState("");
  const [omrade, setOmrade] = useState("");
  const [service, setService] = useState("");
  const [ort, setOrt] = useState("");
  const [error, setError] = useState("");

  // Samma parametrar som skickas vidare till resultatsidan läses tillbaka här, så
  // att "Tillbaka till filtret" visar det besökaren redan fyllt i istället för ett
  // tomt formulär. Adressen läses efter första renderingen: useSearchParams hade
  // krävt en Suspense-gräns, och då hade serverns HTML saknat hela sidan — rubrik
  // och bolagskort, det sökmotorerna ska läsa.
  useEffect(() => {
    const parametrar = new URLSearchParams(window.location.search);
    setBeskrivning(parametrar.get("beskrivning") || "");
    setOmrade(parametrar.get("omrade") || "");
    setService(parametrar.get("tjanst") || "");
    setOrt(parametrar.get("ort") || "");
  }, []);

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
      <section className="hero hero-sok">
        <div>
          <div className="eyebrow">Hitta partners · Sverige</div>
          <h1 className="hero-title">Hitta rätt bolag för uppdraget</h1>
          <p className="hero-sub">
            Ange ort och yrkesområde och beskriv vad ni söker. Vi visar bemannings- och rekryteringsbolagen
            som passar bäst först.
          </p>
          <div className="hero-stats">
            <div className="stat"><span className="num">{antalBolag.toLocaleString("sv-SE")}</span><span className="label">Bolag i registret</span></div>
          </div>
        </div>
        <div className="hero-panel">
          <h2 className="filter-title">Kvickfiltret</h2>
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
            <label htmlFor="pt-service" className="med-info">
              Tjänst
              <TjanstInfo />
            </label>
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
        <h2>Ett urval ur registret</h2>
        <div className="grid" onClickCapture={vidKortklick}>
          {urval.map((c) => (
            <CompanyCard company={c} key={c.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
