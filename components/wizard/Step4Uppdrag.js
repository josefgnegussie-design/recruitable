const UPPDRAG_OPTS = ["Långsiktigt (Heltid)", "Långsiktigt (Extra)", "Kortsiktigt (Heltid)", "Kortsiktigt (Extra)"];
const START_OPTS = ["Omgående", "1-2 veckor", "3 veckor eller mer"];

export default function Step4Uppdrag({ flow, patch, onNext, onBack }) {
  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 4 av 6</div>
      <h3>Uppdragstyp &amp; start</h3>
      <p className="sub">Välj den typ av uppdrag som stämmer bäst, och när det förväntas dra igång.</p>
      <div className="field">
        <div className="flow-chip-row">
          {UPPDRAG_OPTS.map((o) => (
            <button key={o} className={`chip ${flow.uppdragstyp === o ? "on" : ""}`} onClick={() => patch({ uppdragstyp: o })}>{o}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="fl-uppdragtid">Förtydliga tidsfristen för ditt behov här</label>
        <textarea
          id="fl-uppdragtid"
          value={flow.uppdragTid}
          onChange={(e) => patch({ uppdragTid: e.target.value })}
          placeholder="T.ex. behovet varar fram till årsskiftet, eller tills vidare."
        ></textarea>
      </div>
      <div className="field">
        <label>När förväntas uppdraget dra igång?</label>
        <div className="flow-chip-row">
          {START_OPTS.map((o) => (
            <button key={o} className={`chip ${flow.startTyp === o ? "on" : ""}`} onClick={() => patch({ startTyp: o })}>{o}</button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="fl-startdatum">Exakt datum (valfritt)</label>
          <input id="fl-startdatum" type="date" value={flow.startDatum} onChange={(e) => patch({ startDatum: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="fl-starttid">Klockslag (valfritt)</label>
          <input id="fl-starttid" type="time" value={flow.startTid} onChange={(e) => patch({ startTid: e.target.value })} />
        </div>
      </div>
      {flow.err && <div className="flow-error">{flow.err}</div>}
      <div className="flow-nav">
        <button className="btn btn-ghost" style={{ flex: "none", padding: "12px 24px" }} onClick={onBack}>&larr; Tillbaka</button>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onNext}>Nästa &rarr;</button>
      </div>
    </div>
  );
}
