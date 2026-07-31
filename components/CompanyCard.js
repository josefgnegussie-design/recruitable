import Link from "next/link";

export default function CompanyCard({ company: c }) {
  return (
    <div className="card">
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
        <div className={`stamp ${c.ka ? "" : "no"}`}>
          <span>{c.ka ? <>KOLLEKTIV-<br />AVTAL</> : <>EJ KA<br />&nbsp;</>}</span>
        </div>
      </div>
      <div className="tag-row">
        {c.focus.map((b) => (
          <span className="tag" key={b}>{b}</span>
        ))}
      </div>
      <p className="card-vision">&ldquo;{c.vision}&rdquo;</p>
      <div className="card-meta">
        <div><b>{c.revenue}</b>Omsättning {c.revenueYear}</div>
        <div><b>{c.employees}</b>Medarbetare {c.employeesYear}</div>
      </div>
      <div className="card-actions">
        <Link className="btn btn-primary" href={`/bolag/${c.id}`}>Se profil</Link>
        {c.link && (
          <a className="btn btn-ghost" href={c.link} target="_blank" rel="noopener noreferrer">Till webbplats</a>
        )}
      </div>
    </div>
  );
}
