import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { INDUSTRY_NEWS } from "@/lib/industryNews";
import NearbyCompanies from "@/components/NearbyCompanies";

const PREVIEW_IDS = [4, 1, 9];

export default function LandingPage() {
  const preview = PREVIEW_IDS.map((id) => COMPANIES.find((c) => c.id === id));
  const focusAreaCount = new Set(COMPANIES.flatMap((c) => c.focus)).size;
  const kaCount = COMPANIES.filter((c) => c.ka).length;
  const oldestYear = Math.min(...COMPANIES.map((c) => c.founded));

  return (
    <div id="view-landing">
      <section className="l-hero l-hero-single">
        <div>
          <div className="l-kicker">Bemanning &amp; rekrytering · Sverige</div>
          <h1>
            Beskriv rollen. Vi hittar <em>rätt partner</em>.
          </h1>
          <p className="l-hero-sub">
            Fyra steg från behov till rätt bemannings- eller rekryteringspartner: beskriv rollen, se vilka bolag
            som matchar, skicka en förfrågan till de som är intressanta — och låt dem höra av sig till er.
          </p>
          <div className="l-cta-row">
            <Link className="btn-lg primary" href="/rekrytera">Till Rekrytera →</Link>
            <Link className="btn-lg text" href="/bolag">Se alla {COMPANIES.length} bolag</Link>
          </div>
        </div>
      </section>

      <section className="l-section tight">
        <div className="pain-grid">
          <div className="pain-cell">
            <div className="pain-mark">// 01</div>
            <h4>Många lika låter lika</h4>
            <p>Bemanning, rekrytering, interim — alla säger ungefär samma sak om sig själva. Svårt att veta vem som faktiskt passar er verksamhet.</p>
          </div>
          <div className="pain-cell">
            <div className="pain-mark">// 02</div>
            <h4>Villkoren är otydliga</h4>
            <p>Kollektivavtal, auktorisation och storlek på konsultstocken avgör om ett samarbete funkar i praktiken — men syns sällan förrän ni redan är i dialog.</p>
          </div>
          <div className="pain-cell">
            <div className="pain-mark">// 03</div>
            <h4>Tiden går åt till möten</h4>
            <p>Att boka in och sitta av introduktionsmöten med bolag som ändå inte passar är den dyraste delen av att hitta rätt partner.</p>
          </div>
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-kicker">Så funkar det</div>
        <h2>Fyra steg till rätt partner</h2>
        <p className="l-section-sub">
          Ni slipper gissa er fram genom listor och introduktionsmöten — Recruitable sköter urvalet, ni sköter
          samtalet.
        </p>
        <div className="steps-row">
          <div className="step-card">
            <div className="step-num"><span className="box-num">1</span>Beskriv</div>
            <h4>Beskriv rollen</h4>
            <p>
              Ange yrkesområde, tjänst och ort i Kvickfiltret — helt utan att skapa konto. Lägg gärna till vad ni
              specifikt söker.
            </p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">2</span>Hitta</div>
            <h4>Hitta rätt bolag</h4>
            <p>
              Se en rangordnad lista över de bemannings- och rekryteringsföretag som faktiskt matchar era
              villkor — omsättning, kollektivavtal och auktorisation direkt synligt.
            </p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">3</span>Skicka</div>
            <h4>Skicka förfrågan</h4>
            <p>
              Välj vilka bolag som är intressanta och beskriv behovet mer i detalj. Förfrågan går direkt till
              dem, utan mellanhänder.
            </p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">4</span>Kontakt</div>
            <h4>Bolagen hör av sig</h4>
            <p>
              De bolag ni valt tar kontakt direkt med er. Ni väljer sedan själva vem ni vill gå vidare med.
            </p>
          </div>
        </div>
      </section>

      <div className="l-stat-band">
        <div className="l-stat-inner">
          <div className="l-stat"><span className="num">{COMPANIES.length}</span><span className="label">Bolag i registret</span></div>
          <div className="l-stat"><span className="num">{focusAreaCount}</span><span className="label">Fokusområden</span></div>
          <div className="l-stat"><span className="num">{kaCount}/{COMPANIES.length}</span><span className="label">Med kollektivavtal</span></div>
          <div className="l-stat"><span className="num">{oldestYear}</span><span className="label">Äldsta etableringsåret</span></div>
        </div>
      </div>

      <section className="l-section tight">
        <div className="l-kicker">Branschnyheter</div>
        <h2>Vad som händer i branschen</h2>
        <div className="news-list">
          {INDUSTRY_NEWS.map((n) => (
            <a className="news-item" href={n.url} target="_blank" rel="noopener noreferrer" key={n.url}>
              <div className="news-meta">{n.source} · {n.date}</div>
              <div className="news-title">{n.title}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="l-section">
        <div className="l-kicker">Ett urval</div>
        <h2>Tre bolag att börja med</h2>
        <p className="l-section-sub">Ett litet nischat bolag, ett mellanstort med lokal förankring och en global generalist — så spänner registret.</p>
        <div className="preview-grid">
          {preview.map((c) => (
            <Link className="preview-card" href={`/bolag/${c.id}`} key={c.id}>
              <div className="pc-top">
                <div>
                  <p className="pc-name">{c.name}</p>
                  <div className="pc-city">{c.city.toUpperCase()} · GRUNDAT {c.founded}</div>
                </div>
              </div>
              <p className="pc-vision">&ldquo;{c.vision}&rdquo;</p>
              <div className="pc-tags">
                {c.focus.map((f) => (
                  <span className="tag" key={f}>{f}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-cta-band">
          <div>
            <h3>Redo att hitta rätt bemannings- eller rekryteringspartner?</h3>
            <p>Filtrera på yrkesområde, tjänst och ort — och skicka en förfrågan direkt till de bolag ni vill kontakta.</p>
          </div>
          <Link className="btn-lg primary" href="/rekrytera">Till Rekrytera</Link>
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-kicker">Nära dig</div>
        <h2>Hitta bolag i din närhet</h2>
        <p className="l-section-sub">Skriv in er adress så listar vi bemannings- och rekryteringsbolagen i registret, från närmast till längst bort.</p>
        <NearbyCompanies />
      </section>

      <section className="l-section tight">
        <div className="l-cta-band">
          <div>
            <h3>Kan vårt bolag bli listat i registret?</h3>
            <p>
              Om ni är ett bemannings- eller rekryteringsföretag som vill bli en del av registret, tryck på{" "}
              <Link href="/for-bolag/registrera">Skapa konto</Link>.
            </p>
          </div>
          <Link className="btn-lg primary" href="/for-bolag/registrera">Skapa konto</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>RECRUITABLE — BEMANNING &amp; REKRYTERING</div>
          <Link href="/integritetspolicy">Integritetspolicy</Link>
          <div>Data kontrollerad augusti 2026 · Prototyp</div>
        </div>
      </footer>
    </div>
  );
}
