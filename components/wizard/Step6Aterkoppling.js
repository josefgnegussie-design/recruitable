export default function Step6Aterkoppling({ flow, onRestart, onExit }) {
  const results = flow.results || [];
  const yes = results.filter((r) => r.accepted).length;

  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 6 av 6</div>
      <h3>Återkoppling</h3>
      <p className="sub"><b>{yes}</b> av {results.length} bolag är aktuella och vill veta mer om ert behov.</p>
      {results.map((r, i) => (
        <div className="flow-result-card" key={i}>
          <div>
            <div className="fs-name">{r.name}</div>
            <div className="fs-meta" style={{ marginTop: 4 }}>{r.note}</div>
          </div>
          <span className={`flow-result-badge ${r.accepted ? "yes" : "no"}`}>{r.accepted ? "Aktuella" : "Ej aktuella"}</span>
        </div>
      ))}
      <div className="flow-demo-badge" style={{ marginTop: 6 }}>Simulerat resultat — inga riktiga bolag har kontaktats</div>
      <div className="flow-nav">
        <button className="btn btn-ghost" style={{ flex: "none", padding: "12px 24px" }} onClick={onRestart}>↻ Testa igen</button>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onExit}>Till startsidan</button>
      </div>
    </div>
  );
}
