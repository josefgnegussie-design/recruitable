import { useMemo } from "react";
import { REGION_MAP } from "@/lib/taxonomy";
import { regionForCity, citiesForRegion } from "@/lib/helpers";

export default function Step2Ort({ flow, patch, onNext, onBack }) {
  const currentRegion = useMemo(() => regionForCity(flow.ort), [flow.ort]);
  const cities = useMemo(() => citiesForRegion(currentRegion), [currentRegion]);

  function handleRegionChange(e) {
    const region = e.target.value;
    const nextCities = citiesForRegion(region);
    if (!nextCities.includes(flow.ort)) patch({ ort: "" });
  }

  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 2 av 6</div>
      <h3>Ort</h3>
      <p className="sub">Välj län och sedan ort — precis som på allabolag.se.</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="fl-region">Län</label>
          <select id="fl-region" value={currentRegion} onChange={handleRegionChange}>
            <option value="">Alla län</option>
            {Object.keys(REGION_MAP).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fl-ort">Ort</label>
          <select id="fl-ort" value={flow.ort} onChange={(e) => patch({ ort: e.target.value })}>
            <option value="">Alla orter</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flow-nav">
        <button className="btn btn-ghost" style={{ flex: "none", padding: "12px 24px" }} onClick={onBack}>&larr; Tillbaka</button>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onNext}>Nästa &rarr;</button>
      </div>
    </div>
  );
}
