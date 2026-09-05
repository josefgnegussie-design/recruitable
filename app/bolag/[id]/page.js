import Link from "next/link";
import { notFound } from "next/navigation";
import { hamtaBolagMedId } from "@/lib/companiesRepo";
import { createPublicClient } from "@/lib/supabase/public";
import { readCachedPremium, writeCachedPremium } from "@/lib/premiumCache";

export const revalidate = 300;

// Inga profilsidor byggs i förväg. Med 59 bolag gick det an, men registret ska
// rymma ett par tusen — då blir det lika många sidor att bygga vid varje
// driftsättning, och ett nytt bolag skulle inte synas förrän nästa bygge.
// I stället byggs varje sida vid första besöket och sparas i fem minuter, så
// att ett godkänt bolag har en profil direkt.
export function generateStaticParams() {
  return [];
}

export default async function ProfilePage({ params }) {
  const { id } = await params;
  const c = await hamtaBolagMedId(id);
  if (!c) notFound();

  // Premiumdata är ett tillägg till grundprofilen i lib/companies.js. Går den
  // inte att hämta — saknad konfiguration, nere eller långsam — ska besökaren
  // ändå få se bolaget, inte ett serverfel.
  let premium = null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("companies")
      .select("is_premium, logo, cover_image, extended_vision, mission, history, expertise, team_members, surveys")
      .eq("id", c.id)
      .maybeSingle();
    if (error) throw error;
    premium = data;
    await writeCachedPremium(c.id, data);
  } catch (err) {
    console.error(`Kunde inte hämta premiumdata för bolag ${c.id}:`, err.message);
    // Faller tillbaka på senast lyckade hämtning så att en betalande kunds
    // utökade profil inte försvinner under en störning.
    premium = await readCachedPremium(c.id);
    if (premium) console.warn(`Visar cachad premiumdata för bolag ${c.id}.`);
  }

  const isPremium = premium?.is_premium ?? false;
  const logo = premium?.logo || c.logo;

  return (
    <div id="view-profile">
      <Link className="back-link" href="/rekrytera">&larr; Tillbaka till sökningen</Link>
      {!c.claimed && (
        <div className="claim-banner">
          <p>
            <strong>Den här profilen är sammanställd ur offentliga register.</strong> Uppgifterna kommer
            från Bolagsverket och årsredovisningar — bolaget har inte själv fyllt i något här.
          </p>
          <Link className="qs-btn" href="/for-bolag/registrera">
            Är detta ert bolag? Ta över profilen
          </Link>
        </div>
      )}
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
              <div className="sub">{(c.officeCities?.length > 1 ? "Flera orter" : c.city).toUpperCase()} · GRUNDAT {c.founded}</div>
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
