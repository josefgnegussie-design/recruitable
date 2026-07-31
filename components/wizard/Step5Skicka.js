import { flowMatches } from "@/lib/helpers";
import { COMPANIES } from "@/lib/companies";

export default function Step5Skicka({ flow, patch, onBack, onSend }) {
  if (flow.sending) {
    return (
      <div className="flow-panel">
        <div className="flow-sending">
          <div className="flow-spinner"></div>
          <p className="sub" style={{ margin: 0 }}>Skickar er förfrågan till {flow.selected.size} bolag...</p>
        </div>
      </div>
    );
  }

  const matches = flowMatches(flow.omrade, flow.ort, COMPANIES);
  const uppdrag = `${flow.uppdragstyp || "—"}${flow.uppdragTid ? " · " + flow.uppdragTid : ""}`;
  const start = `${flow.startTyp || "—"}${flow.startDatum ? " · " + flow.startDatum : ""}${flow.startTid ? " · kl. " + flow.startTid : ""}`;
  const prisrader =
    flow.kollektivavtal === "IF Metall"
      ? `GFL ${flow.gflResult ? flow.gflResult.summa.toFixed(2) + " kr/h" : "—"} · Timdebitering, normaltid ${flow.timdebiteringNormaltid || "—"} kr/h${flow.faktorOB ? ` · Faktor, OB/ÖT/övrig tid ${flow.faktorOB}` : ""}`
      : flow.kollektivavtal === "Unionen"
      ? `Timdebitering ${flow.timdebitering || "—"} kr/h`
      : flow.prisintervall || "—";

  function toggleSelect(id) {
    const next = new Set(flow.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ selected: next });
  }

  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 5 av 6</div>
      <h3>Skicka förfrågan till valda bolag</h3>
      <p className="sub"><b>{matches.length}</b> bolag matchar er ort och bransch. Bocka ur de ni inte vill kontakta.</p>
      <div className="flow-suggest-list">
        {matches.length === 0 ? (
          <p className="sub">Inga bolag matchar er ort/bransch just nu — gå tillbaka och bredda urvalet.</p>
        ) : (
          matches.map((c) => (
            <div className="flow-suggest-card" key={c.id}>
              <div className={`box ${flow.selected.has(c.id) ? "checked" : ""}`} onClick={() => toggleSelect(c.id)} style={{ cursor: "pointer" }}></div>
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => toggleSelect(c.id)}>
                <div className="fs-name">{c.name}</div>
                <div className="fs-meta">{c.city.toUpperCase()} &middot; {c.employees} MEDARBETARE &middot; {c.ka ? "KOLLEKTIVAVTAL" : "EJ KOLLEKTIVAVTAL"}</div>
              </div>
            </div>
          ))
        )}
      </div>
      {flow.err && <div className="flow-error">{flow.err}</div>}
      <div className="flow-summary-row"><span className="k">Yrke</span><span className="v">{flow.yrke || "Alla"}</span></div>
      <div className="flow-summary-row"><span className="k">Kollektivavtal</span><span className="v">{flow.kollektivavtal || "—"}</span></div>
      <div className="flow-summary-row"><span className="k">Pris</span><span className="v">{prisrader}</span></div>
      <div className="flow-summary-row"><span className="k">Uppdragstyp</span><span className="v">{uppdrag}</span></div>
      <div className="flow-summary-row"><span className="k">Start</span><span className="v">{start}</span></div>
      <div className="flow-demo-badge" style={{ marginTop: 16 }}>Detta är en simulering — ingen förfrågan skickas i verkligheten</div>
      <div className="flow-nav">
        <button className="btn btn-ghost" style={{ flex: "none", padding: "12px 24px" }} onClick={onBack}>&larr; Tillbaka</button>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onSend}>Skicka förfrågan ({flow.selected.size}) &rarr;</button>
      </div>
    </div>
  );
}
