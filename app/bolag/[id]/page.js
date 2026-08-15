import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 300;

export function generateStaticParams() {
  return COMPANIES.map((c) => ({ id: String(c.id) }));
}

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const c = COMPANIES.find((x) => x.id === Number(id));
  if (!c) notFound();

  const supabase = createPublicClient();
  const { data: premium } = await supabase
    .from("companies")
    .select("is_premium, logo, cover_image, extended_vision, mission, history, expertise, team_members, surveys")
    .eq("id", c.id)
    .maybeSingle();

  const isPremium = premium?.is_premium ?? false;
  const logo = premium?.logo || c.logo;

  return (
    <div id="view-profile">
      <Link className="back-link" href="/bolag">&larr; Tillbaka till alla bolag</Link>
      <div className="profile-wrap">
        {isPremium && premium?.cover_image && (
          <div className="profile-cover">
            <img src={premium.cover_image} alt="" />
          </div>
        )}
        <div className="profile-head">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logo && (
              <img src={logo} alt="" className="profile-logo" />
            )}
            <div>
              <h2>{c.name}</h2>
              <div className="sub">{c.city.toUpperCase()} · GRUNDAT {c.founded}</div>
              <div className="tags">
                {c.focus.concat(c.services).map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
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
              <div className="side-fact"><span className="k">Orter</span><span className="v">{c.officeCities?.length ? c.officeCities.join(", ") : c.address}</span></div>
              <div className="side-fact"><span className="k">Fokusområden</span><span className="v">{c.focus.length ? c.focus.join(", ") : "Ej specificerat"}</span></div>
              <div className="side-fact"><span className="k">Tjänster</span><span className="v">{c.services.join(", ")}</span></div>
              <div className="note">Källa: offentlig bolagsdata (Allabolag/Ratsit/Bolagsfakta) + bolagets webbplats, kontrollerad augusti 2026.</div>
            </div>
          </div>
        </div>

        {isPremium && (
          <div className="premium-section">
            <div className="premium-label">Bolagets egen presentation</div>
            <p className="premium-note">
              Det här avsnittet skrivs och underhålls av {c.name} själva — till skillnad från uppgifterna ovan,
              som är oberoende verifierade av Recruitable.
            </p>

            {(premium.mission || premium.history || premium.expertise) && (
              <div className="profile-body" style={{ marginTop: 20 }}>
                <div>
                  {premium.mission && (
                    <div className="panel">
                      <h3>Mission</h3>
                      <p>{premium.mission}</p>
                    </div>
                  )}
                  {premium.history && (
                    <div className="panel">
                      <h3>Historia</h3>
                      <p>{premium.history}</p>
                    </div>
                  )}
                  {premium.expertise && (
                    <div className="panel">
                      <h3>Erfarenhet</h3>
                      <p>{premium.expertise}</p>
                    </div>
                  )}
                </div>
                <div>
                  {(premium.surveys?.customer_satisfaction || premium.surveys?.employee_satisfaction) && (
                    <div className="panel">
                      <h3>Undersökningar</h3>
                      {premium.surveys?.customer_satisfaction && (
                        <div className="side-fact">
                          <span className="k">Kundnöjdhet</span>
                          <span className="v">{premium.surveys.customer_satisfaction.score.toFixed(1)} / 5</span>
                        </div>
                      )}
                      {premium.surveys?.customer_satisfaction?.source && (
                        <div className="note">Källa: {premium.surveys.customer_satisfaction.source}</div>
                      )}
                      {premium.surveys?.employee_satisfaction && (
                        <div className="side-fact" style={{ marginTop: 10 }}>
                          <span className="k">Medarbetarnöjdhet</span>
                          <span className="v">{premium.surveys.employee_satisfaction.score.toFixed(1)} / 5</span>
                        </div>
                      )}
                      {premium.surveys?.employee_satisfaction?.source && (
                        <div className="note">Källa: {premium.surveys.employee_satisfaction.source}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {premium.team_members?.length > 0 && (
              <div className="panel" style={{ marginTop: 20 }}>
                <h3>Medarbetare</h3>
                <div className="team-grid">
                  {premium.team_members.map((m, i) => (
                    <div className="team-member" key={i}>
                      <div className="team-member-photo">
                        {m.photo_url ? <img src={m.photo_url} alt="" /> : <span>{m.name?.[0]}</span>}
                      </div>
                      <div className="team-member-name">{m.name}</div>
                      <div className="team-member-role">{m.role}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
