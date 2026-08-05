"use client";

export default function SelectableCompanyCard({ company: c, selected, onToggle }) {
  return (
    <div className={`card selectable${selected ? "" : " excluded"}`} onClick={() => onToggle(c.id)}>
      <div className="card-top">
        <div>
          <p className="card-name">{c.name}</p>
          <div className="card-city">
            {c.city.toUpperCase()} · GRUNDAT {c.founded}
          </div>
          <div className={`card-rating${c.rating ? "" : " none"}`}>
            {c.rating ? (
              <>
                <span className="star">★</span> {c.rating.toFixed(1)} <span>({c.ratingCount} på Google)</span>
              </>
            ) : (
              "Inga Google-recensioner"
            )}
          </div>
        </div>
        <div className="card-top-right">
          <label className="card-select" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(c.id)} />
          </label>
          <div className={`stamp ${c.ka ? "" : "no"}`}>
            <span>{c.ka ? <>KOLLEKTIV-<br />AVTAL</> : <>EJ KA<br />&nbsp;</>}</span>
          </div>
        </div>
      </div>
      <div className="tag-row">
        {c.focus.map((b) => (
          <span className="tag" key={b}>{b}</span>
        ))}
      </div>
      <p className="card-vision">&ldquo;{c.vision}&rdquo;</p>
    </div>
  );
}
