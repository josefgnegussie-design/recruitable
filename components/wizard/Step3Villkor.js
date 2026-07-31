import { computeGFL } from "@/lib/gfl";

export default function Step3Villkor({ flow, patch, onNext, onBack }) {
  function handleCalcGFL() {
    const r = computeGFL(flow.gflT, flow.gflP, flow.gflOvriga, flow.gflArbetstid, flow.gflForkortning);
    if (!r) {
      patch({ gflResult: null, timdebiteringNormaltid: "", err: "Fyll i samtliga fem fält (T, P, övriga tillägg, arbetstid och arbetstidsförkortning) för att beräkna." });
    } else {
      const faktorNum = parseFloat(String(flow.faktor).replace(",", "."));
      const timdebiteringNormaltid = !isNaN(faktorNum) ? (r.summa * faktorNum).toFixed(2) : "";
      patch({ gflResult: r, timdebiteringNormaltid, err: null });
    }
  }

  function handleFaktorChange(e) {
    const faktor = e.target.value;
    const faktorNum = parseFloat(String(faktor).replace(",", "."));
    const timdebiteringNormaltid = flow.gflResult && !isNaN(faktorNum) ? (flow.gflResult.summa * faktorNum).toFixed(2) : "";
    patch({ faktor, timdebiteringNormaltid });
  }

  const timdebDisplay = flow.timdebiteringNormaltid
    ? `GFL × Faktor = ${flow.timdebiteringNormaltid} kr/h`
    : "GFL × Faktor";

  let priceFields = null;
  if (flow.kollektivavtal === "Unionen") {
    priceFields = (
      <div className="field">
        <label htmlFor="fl-timdeb">Timdebitering (kr/h)</label>
        <input
          id="fl-timdeb"
          type="text"
          value={flow.timdebitering}
          onChange={(e) => patch({ timdebitering: e.target.value })}
          placeholder="T.ex. 350–450 kr/h"
        />
      </div>
    );
  } else if (flow.kollektivavtal === "IF Metall") {
    priceFields = (
      <>
        <div className="hint" style={{ margin: "-4px 0 16px" }}>
          Vid kollektivavtal knutet till IF Metall tillämpas GFL (Genomsnittligt förtjänstläge) enligt bemanningsavtalet § 5.
        </div>
        <div className="gfl-calc">
          <div className="gfl-calc-title">Grunddata, jämförbar grupp</div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="fl-gflT">Tidlön, T (kr/månad)</label>
              <input id="fl-gflT" type="text" value={flow.gflT} onChange={(e) => patch({ gflT: e.target.value })} placeholder="T.ex. 30 000" />
            </div>
            <div className="field">
              <label htmlFor="fl-gflP">Prestationslön, P (kr/månad)</label>
              <input id="fl-gflP" type="text" value={flow.gflP} onChange={(e) => patch({ gflP: e.target.value })} placeholder="T.ex. 0" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="fl-gflOvriga">Övriga tillägg (kr/månad)</label>
              <input id="fl-gflOvriga" type="text" value={flow.gflOvriga} onChange={(e) => patch({ gflOvriga: e.target.value })} placeholder="T.ex. 0" />
            </div>
            <div className="field">
              <label htmlFor="fl-gflArbetstid">Arbetstid, jämförbargrupp (h/vecka)</label>
              <input id="fl-gflArbetstid" type="text" value={flow.gflArbetstid} onChange={(e) => patch({ gflArbetstid: e.target.value })} placeholder="T.ex. 38" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="fl-gflForkortning">Arbetstidsförkortning (minuter/vecka)</label>
            <input id="fl-gflForkortning" type="text" value={flow.gflForkortning} onChange={(e) => patch({ gflForkortning: e.target.value })} placeholder="T.ex. 82" />
          </div>
          <button className="btn btn-ghost" style={{ flex: "none", padding: "10px 20px", marginBottom: 14 }} onClick={handleCalcGFL}>Beräkna GFL</button>
          {flow.gflResult ? (
            <>
              <div className="flow-summary-row"><span className="k">T per timme</span><span className="v">{flow.gflResult.tPerH.toFixed(2)} kr</span></div>
              <div className="flow-summary-row"><span className="k">P per timme</span><span className="v">{flow.gflResult.pPerH.toFixed(2)} kr</span></div>
              <div className="flow-summary-row"><span className="k">Övriga tillägg per timme</span><span className="v">{flow.gflResult.oPerH.toFixed(2)} kr</span></div>
              <div className="flow-summary-row"><span className="k">Skiftformstillägg per timme</span><span className="v">{flow.gflResult.skift.toFixed(2)} kr</span></div>
              <div className="flow-summary-row"><span className="k">Arbetstidsförkortning per timme</span><span className="v">{flow.gflResult.forkPerH.toFixed(2)} kr</span></div>
              <div className="flow-summary-row" style={{ fontWeight: 600 }}><span className="k">GFL — summa lön per timme</span><span className="v">{flow.gflResult.summa.toFixed(2)} kr/h</span></div>
            </>
          ) : (
            <div className="hint">Fyll i alla fem fält ovan och klicka på Beräkna GFL för att se resultatet.</div>
          )}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="fl-faktor">Faktor, Normaltid</label>
            <input id="fl-faktor" type="number" min="0" max="10" step="0.01" value={flow.faktor} onChange={handleFaktorChange} placeholder="T.ex. 2,00 (normaltid)" />
          </div>
          <div className="field">
            <label htmlFor="fl-timdebnormal">Timdebitering, normaltid (kr/h)</label>
            <div className="gfl-readonly">{timdebDisplay}</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="fl-faktor-ob">Faktor, OB/ÖT/Övrig tid</label>
          <input id="fl-faktor-ob" type="number" min="0" max="10" step="0.01" value={flow.faktorOB} onChange={(e) => patch({ faktorOB: e.target.value })} placeholder="T.ex. 1,85 (OB/ÖT)" />
        </div>
      </>
    );
  } else {
    priceFields = (
      <div className="field">
        <label htmlFor="fl-pris">Prisintervall (kr/h)</label>
        <input
          id="fl-pris"
          type="text"
          value={flow.prisintervall}
          onChange={(e) => patch({ prisintervall: e.target.value })}
          placeholder="T.ex. 350–450 kr/h"
        />
      </div>
    );
  }

  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 3 av 6</div>
      <h3>Kollektivavtal &amp; prisintervall</h3>
      <p className="sub">Ange ert eget kollektivavtal och vilket timpris ni söker.</p>
      <div className="field">
        <label htmlFor="fl-ka">Ditt kollektivavtal</label>
        <select id="fl-ka" value={flow.kollektivavtal} onChange={(e) => patch({ kollektivavtal: e.target.value })}>
          <option value="">Inget/ej aktuellt</option>
          <option value="IF Metall">IF Metall</option>
          <option value="Unionen">Unionen</option>
        </select>
      </div>
      {priceFields}
      {flow.err && <div className="flow-error">{flow.err}</div>}
      <div className="flow-nav">
        <button className="btn btn-ghost" style={{ flex: "none", padding: "12px 24px" }} onClick={onBack}>&larr; Tillbaka</button>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onNext}>Nästa &rarr;</button>
      </div>
    </div>
  );
}
