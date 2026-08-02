import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPANIES } from "@/lib/companies";

export function generateStaticParams() {
  return COMPANIES.map((c) => ({ id: String(c.id) }));
}

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const c = COMPANIES.find((x) => x.id === Number(id));
  if (!c) notFound();

  return (
    <div id="view-profile">
      <Link className="back-link" href="/bolag">&larr; Tillbaka till alla bolag</Link>
      <div className="profile-wrap">
        <div className="profile-head">
          <div>
            <h2>{c.name}</h2>
            <div className="sub">{c.city.toUpperCase()} · GRUNDAT {c.founded}</div>
            <div className="tags">
              {c.focus.concat(c.services).map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </div>
          </div>
          <div className="profile-actions">
            {c.link ? (
              <a className="btn btn-primary" href={c.link} target="_blank" rel="noopener noreferrer">Besök webbplats</a>
            ) : (
              <span className="note">Ingen webbplats verifierad</span>
            )}
          </div>
        </div>

        <div className="spec-grid">
          <div className="spec-cell">
            <div className="k">Omsättning</div>
            <div className="v">{c.revenue}</div>
            <div className="y">Räkenskapsår {c.revenueYear}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Medarbetare</div>
            <div className="v">{c.employees}</div>
            <div className="y">Räkenskapsår {c.employeesYear}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Kollektivavtal</div>
            <div className="v">{c.ka ? "Ja" : "Nej"}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Grundat</div>
            <div className="v">{c.founded}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Google-betyg</div>
            <div className="v">{c.rating ? `★ ${c.rating.toFixed(1)}` : "—"}</div>
            <div className="y">{c.rating ? `${c.ratingCount} recensioner` : "Inga recensioner"}</div>
          </div>
        </div>

        <div className="profile-body">
          <div>
            <div className="panel">
              <h3>Vision</h3>
              <p className="vision-quote">&ldquo;{c.vision}&rdquo;</p>
            </div>
            <div className="panel">
              <h3>Om bolaget</h3>
              <p>{c.desc}</p>
            </div>
          </div>
          <div>
            <div className="panel">
              <h3>Snabbfakta</h3>
              <div className="side-fact"><span className="k">Kontorsadress</span><span className="v">{c.address}</span></div>
              <div className="side-fact"><span className="k">Fokusområden</span><span className="v">{c.focus.length ? c.focus.join(", ") : "Ej specificerat"}</span></div>
              <div className="side-fact"><span className="k">Tjänster</span><span className="v">{c.services.join(", ")}</span></div>
              {c.contact && (
                <div className="side-fact"><span className="k">Kontakt</span><span className="v">{c.contact}</span></div>
              )}
              <div className="note">Källa: offentlig bolagsdata (Allabolag/Ratsit/Bolagsfakta) + bolagets webbplats, kontrollerad augusti 2026.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
