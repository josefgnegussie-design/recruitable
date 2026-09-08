// Byggstenarna i den interna dashboarden. Rena serverkomponenter — inget av
// det här behöver köras i webbläsaren, så inget av det skickas dit heller.
//
// Färgerna: teal #1189a8 och husets rost #d97b3f. Paret är valt för att hålla
// isär även för den som inte skiljer rött från grönt (ΔE 15,7 vid protanopi),
// vilket grönt/rött inte gör (ΔE 5,4 — praktiskt taget samma färg). Obesvarat
// bär ingen egen färg alls, bara grått, och varje serie är dessutom textad —
// färgen är aldrig det enda som skiljer dem åt.
export const FARG = {
  accepterade: "#1189a8",
  nekade: "#d97b3f",
  obesvarade: "#c7c2b8",
};

const nf = new Intl.NumberFormat("sv-SE");

export function tal(v) {
  return nf.format(v ?? 0);
}

function kortDatum(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

// ============================================================
// Nyckeltal — en siffra per kort, med förändringen mot föregående
// lika långa period när det finns något att jämföra med.
// ============================================================
export function Nyckeltal({ poster }) {
  return (
    <div className="stat-rutnat">
      {poster.map((p) => (
        <div className="stat-kort" key={p.etikett}>
          <p className="stat-etikett">{p.etikett}</p>
          <p className="stat-varde">
            {p.varde}
            {p.suffix && <span className="stat-suffix">{p.suffix}</span>}
          </p>
          {p.forandring !== null && p.forandring !== undefined && (
            <p className={`stat-forandring${p.forandring < 0 ? " ned" : ""}`}>
              {p.forandring > 0 ? "+" : ""}
              {p.forandring} % mot föregående period
            </p>
          )}
          {p.hjalp && <p className="stat-hjalp">{p.hjalp}</p>}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Sidvisningar per dag. En serie, alltså ingen förklaringsruta — rubriken
// säger vad staplarna är. Bara var n:te datum skrivs ut, annars växer
// etiketterna ihop så fort perioden blir längre än ett par veckor.
// ============================================================
export function Dagsdiagram({ dagar }) {
  // Dagarna fylls ut med nollor innan de kommer hit. En helt tom period ska
  // säga det med ord, inte visa en tom axel som ser trasig ut.
  if (!dagar.some((d) => d.sidvisningar > 0))
    return <p className="tomt">Inga sidvisningar registrerade i perioden.</p>;

  const hojd = 150;
  // Fast ritbredd oavsett antal dagar: staplarna blir smalare när perioden
  // växer, istället för att bilden blir bredare och texten dras ut på
  // längden. 7 dagar och 365 dagar ska se ut som samma diagram.
  const bredd = 720;
  const steg = bredd / dagar.length;
  const stapelbredd = Math.max(1.5, steg - 2);
  const max = Math.max(...dagar.map((d) => d.sidvisningar), 1);
  const etikettsteg = Math.max(1, Math.ceil(dagar.length / 8));

  return (
    <figure className="diagram">
      <svg
        viewBox={`0 0 ${bredd} ${hojd + 22}`}
        role="img"
        aria-label={`Sidvisningar per dag, som mest ${max} en enskild dag`}
        style={{ width: "100%", height: "auto" }}
      >
        <line x1="0" y1={hojd} x2={bredd} y2={hojd} stroke="var(--color-hairline)" strokeWidth="1" />
        {dagar.map((d, i) => {
          const h = Math.max(d.sidvisningar > 0 ? 2 : 0, (d.sidvisningar / max) * hojd);
          return (
            <g key={d.dag}>
              <rect
                x={i * steg}
                y={hojd - h}
                width={stapelbredd}
                height={h}
                rx={stapelbredd > 5 ? 2 : 0}
                fill={FARG.accepterade}
              >
                <title>
                  {kortDatum(d.dag)}: {tal(d.sidvisningar)} sidvisningar
                  {d.besokare ? `, ${tal(d.besokare)} besökare` : ""}
                </title>
              </rect>
              {i % etikettsteg === 0 && (
                <text
                  x={i * steg + stapelbredd / 2}
                  y={hojd + 15}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-muted)"
                >
                  {kortDatum(d.dag)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="diagram-not">Som mest {tal(max)} sidvisningar en enskild dag.</figcaption>
    </figure>
  );
}

// ============================================================
// Utfallet som en liggande stapel: hur de utskickade förfrågningarna
// fördelar sig på accepterade, nekade och obesvarade.
// ============================================================
export function Utfallsstapel({ accepterade, nekade, obesvarade }) {
  const summa = accepterade + nekade + obesvarade;

  if (!summa) return <p className="tomt">Inga förfrågningar har nått bolagen i perioden.</p>;

  const delar = [
    { etikett: "Accepterade", varde: accepterade, farg: FARG.accepterade },
    { etikett: "Nekade", varde: nekade, farg: FARG.nekade },
    { etikett: "Obesvarade", varde: obesvarade, farg: FARG.obesvarade },
  ].filter((d) => d.varde > 0);

  return (
    <div>
      <div className="utfallsstapel">
        {delar.map((d) => (
          <div
            key={d.etikett}
            style={{ width: `${(d.varde / summa) * 100}%`, background: d.farg }}
            title={`${d.etikett}: ${tal(d.varde)} av ${tal(summa)}`}
          />
        ))}
      </div>
      <ul className="forklaring">
        {delar.map((d) => (
          <li key={d.etikett}>
            <span className="prick" style={{ background: d.farg }} />
            {d.etikett} <b>{tal(d.varde)}</b>{" "}
            <span className="andel">{Math.round((d.varde / summa) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Utfall per månad, staplade kolumner. Här behövs förklaringsrutan —
// tre serier, och ingen av dem får kännas igen på färgen ensam.
// ============================================================
export function Manadsdiagram({ manader }) {
  // Månaderna fylls ut med nollor innan de kommer hit, så tomheten mäts på
  // innehållet och inte på antalet staplar.
  if (!manader.some((m) => m.utskick > 0)) return <p className="tomt">Ingen historik att visa än.</p>;

  const hojd = 150;
  const kolumn = 46;
  const bredd = manader.length * kolumn;
  const max = Math.max(...manader.map((m) => m.utskick), 1);

  return (
    <figure className="diagram">
      <svg
        viewBox={`0 0 ${bredd} ${hojd + 40}`}
        role="img"
        aria-label="Utfall av förfrågningar per månad"
        style={{ width: "100%", height: "auto" }}
      >
          <line x1="0" y1={hojd} x2={bredd} y2={hojd} stroke="var(--color-hairline)" strokeWidth="1" />
          {manader.map((m, i) => {
            const skala = (v) => (v / max) * (hojd - 18);
            const segment = [
              { v: m.obesvarade, farg: FARG.obesvarade, namn: "Obesvarade" },
              { v: m.nekade, farg: FARG.nekade, namn: "Nekade" },
              { v: m.accepterade, farg: FARG.accepterade, namn: "Accepterade" },
            ];
            let y = hojd;
            return (
              <g key={m.manad}>
                {segment.map((s) => {
                  if (!s.v) return null;
                  // 2 px luft mellan segmenten, så gränsen syns även för den
                  // som inte kan skilja färgerna åt.
                  const h = Math.max(2, skala(s.v) - 2);
                  y -= h + 2;
                  return (
                    <rect key={s.namn} x={i * kolumn + 8} y={y} width={kolumn - 16} height={h} rx="3" fill={s.farg}>
                      <title>{`${s.namn} i ${m.etikett}: ${tal(s.v)}`}</title>
                    </rect>
                  );
                })}
                <text
                  x={i * kolumn + kolumn / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-body)"
                >
                  {tal(m.utskick)}
                </text>
                <text
                  x={i * kolumn + kolumn / 2}
                  y={hojd + 15}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--color-muted)"
                >
                  {m.kort}
                </text>
              </g>
            );
          })}
      </svg>
      <ul className="forklaring">
        <li>
          <span className="prick" style={{ background: FARG.accepterade }} />
          Accepterade
        </li>
        <li>
          <span className="prick" style={{ background: FARG.nekade }} />
          Nekade
        </li>
        <li>
          <span className="prick" style={{ background: FARG.obesvarade }} />
          Obesvarade
        </li>
      </ul>
    </figure>
  );
}

// ============================================================
// Topplista — sidor, orter, yrkesområden. Stapeln ligger bakom texten som
// en bakgrund, så raden går att läsa även utan att tolka längden.
// ============================================================
export function Topplista({ rader, tom }) {
  if (!rader.length) return <p className="tomt">{tom}</p>;

  const max = Math.max(...rader.map((r) => r.varde), 1);

  return (
    <ol className="topplista">
      {rader.map((r) => (
        <li key={r.etikett}>
          <span className="topplista-fyllning" style={{ width: `${(r.varde / max) * 100}%` }} />
          <span className="topplista-namn">{r.etikett}</span>
          <span className="topplista-varde">
            {tal(r.varde)}
            {r.sekundar && <em>{r.sekundar}</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ============================================================
// Rutan som visas när migrationen inte är körd. Skild från "inget har hänt
// än" med flit: en tom dashboard som egentligen betyder att SQL-filen aldrig
// kördes är precis det misstag som en gång bröt registreringen tyst.
// ============================================================
export function MigrationSaknas({ fil }) {
  return (
    <div className="admin-varning">
      <p>
        <b>Databasen saknar det här ännu.</b> Kör <code>{fil}</code> i Supabase → SQL Editor, så fylls avsnittet.
      </p>
    </div>
  );
}
