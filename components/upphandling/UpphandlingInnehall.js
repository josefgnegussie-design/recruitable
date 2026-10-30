import { datumText } from "@/lib/upphandling";

const NIVA = { ska: "Ska", bor: "Bör" };

export function UpphandlingBeskrivning({ u }) {
  return (
    <>
      <section className="auth-panel">
        <h2 className="upp-rubrik-liten">Om upphandlingen</h2>
        <p className="upp-brod">{u.description}</p>
        {u.buyer_type === "offentlig" && (
          <p className="upp-not">
            Det här är en marknadsdialog. Själva upphandlingen annonseras separat av köparen.
          </p>
        )}
      </section>

      <section className="auth-panel">
        <h2 className="upp-rubrik-liten">Det här ska levereras</h2>
        <dl className="upp-fakta">
          <dt>Orter</dt>
          <dd>{u.cities.join(", ")}</dd>
          <dt>Kompetenser</dt>
          <dd>{u.competences.join(", ")}</dd>
          <dt>Yrkesområden</dt>
          <dd>{u.focus_areas.join(", ")}</dd>
        </dl>
      </section>

      {u.requirements.length > 0 && (
        <section className="auth-panel">
          <h2 className="upp-rubrik-liten">Krav</h2>
          <ul className="upp-krav">
            {u.requirements.map((k) => (
              <li key={k.id}>
                <span className={`upp-niva ${k.niva}`}>{NIVA[k.niva]}</span>
                <span>{k.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export function UpphandlingFragor({ fragor, children }) {
  return (
    <section className="auth-panel">
      <h2 className="upp-rubrik-liten">Frågor och svar</h2>
      <p className="upp-not">Frågorna är anonyma. Köparens svar visas för alla leverantörer.</p>
      {fragor.length === 0 && <p className="upp-brod">Inga frågor är besvarade än.</p>}
      {fragor.map((f) => (
        <div className="upp-fraga" key={f.id}>
          <strong>{f.fraga}</strong>
          <span>{f.svar}</span>
        </div>
      ))}
      {children}
    </section>
  );
}

export function UpphandlingTidplan({ u }) {
  const rader = [
    ["Sista dag för frågor", u.questions_deadline],
    ["Sista dag att anmäla intresse", u.interest_deadline],
    ["Besked till leverantörer", u.decision_date],
    ["Planerad avtalsstart", u.contract_start],
  ].filter(([, d]) => d);

  return (
    <section className="auth-panel">
      <h2 className="upp-rubrik-liten">Tidplan</h2>
      <dl className="upp-tidplan">
        {rader.map(([vad, d]) => (
          <div key={vad}>
            <dt>{vad}</dt>
            <dd>{datumText(d)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function UpphandlingFakta({ u }) {
  return (
    <section className="auth-panel">
      <h2 className="upp-rubrik-liten">Fakta</h2>
      <dl className="upp-fakta">
        <dt>Tjänst</dt>
        <dd>{u.service}</dd>
        {u.contract_period && (
          <>
            <dt>Avtalstid</dt>
            <dd>{u.contract_period}</dd>
          </>
        )}
        {u.volume && (
          <>
            <dt>Volym</dt>
            <dd>{u.volume}</dd>
          </>
        )}
        <dt>Pris</dt>
        <dd>Begärs i nästa steg</dd>
      </dl>
    </section>
  );
}
