// Korten för pågående upphandlingar (/upphandling) och pågående förfrågningar
// (/rekrytera): ort, rubrik, en mening och stegen på en orange linje. Ett
// steg utan datum har inte hänt ännu och visas med en ofylld punkt.
export default function PagaendeLista({ id, rubrik, intro, kort, stegEtikett }) {
  if (!kort.length) return null;
  return (
    <section className="upp-pagaende" aria-labelledby={id}>
      <h2 id={id} className="upp-rubrik-liten">{rubrik}</h2>
      <p className="upp-not" style={{ marginTop: 0 }}>{intro}</p>
      <ul className="upp-pagaende-lista">
        {kort.map((u, i) => (
          <li key={i} className="auth-panel upp-pagaende-kort">
            {u.exempel && <span className="tag upp-exempel-tagg">Exempel</span>}
            {u.orter && <p className="upp-pagaende-ort">{u.orter}</p>}
            <h3>{u.rubrik}</h3>
            <p className="upp-pagaende-text">{u.mening}</p>
            <ol className="upp-tidslinje" aria-label={stegEtikett} style={{ "--steg": u.tidslinje.length }}>
              {u.tidslinje.map((t) => (
                <li key={t.steg}>
                  <span className={t.datum ? "punkt" : "punkt tom"} aria-hidden="true" />
                  <span className={t.framhavd ? "steg framhavd" : "steg"}>{t.steg}</span>
                  <span className="datum">{t.datum ?? "–"}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Inledningen under rubriken, beroende på om korten är riktiga, exempel eller
// en blandning.
export function pagaendeIntro(kort, { riktiga, exempel }) {
  const harRiktiga = kort.some((u) => !u.exempel);
  const harExempel = kort.some((u) => u.exempel);
  const text = harRiktiga ? riktiga : exempel;
  return harRiktiga && harExempel ? `${text} Kort märkta Exempel visar hur det kan se ut.` : text;
}
