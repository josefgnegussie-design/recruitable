import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import QuickStartPanel from "@/components/QuickStartPanel";
import BranchPicker from "@/components/BranchPicker";

const PREVIEW_IDS = [4, 1, 9];

export default function LandingPage() {
  const preview = PREVIEW_IDS.map((id) => COMPANIES.find((c) => c.id === id));

  return (
    <div id="view-landing">
      <section className="l-hero">
        <div>
          <div className="l-kicker">Bemanning &amp; rekrytering · Västra Götaland</div>
          <h1>
            Välj partner helt <em>objektivt</em>
            <br />
            utefter dina behov och villkor.
          </h1>
          <p className="l-hero-sub">
            Med Recruitable kan du se över samtliga bemannings- och rekryteringsföretag i er region mer detaljerat innan
            ni lägger tid och energi på möten och avtalsdialoger.
            <br />
            <br />
            Genom Recruitable går det att sätta villkoren och förmedla behoven innan ett första möte.
          </p>
          <div className="l-cta-row">
            <Link className="btn-lg primary" href="/bolag">Se alla 20 bolag</Link>
            <a className="btn-lg text" href="#l-how">Så funkar det ↓</a>
          </div>
        </div>
        <QuickStartPanel />
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
            <p>Kollektivavtal, ledtider och storlek på konsultstocken avgör om ett samarbete funkar i praktiken — men syns sällan förrän ni redan är i dialog.</p>
          </div>
          <div className="pain-cell">
            <div className="pain-mark">// 03</div>
            <h4>Tiden går åt till möten</h4>
            <p>Att boka in och sitta av introduktionsmöten med bolag som ändå inte passar är den dyraste delen av att hitta rätt partner.</p>
          </div>
        </div>
      </section>

      <section className="l-section tight" id="l-branch">
        <div className="l-kicker">Bransch</div>
        <h2>Välj er bransch</h2>
        <p className="l-section-sub">Fler branscher tillkommer efter hand — börja med att se bolag inom industri eller logistik.</p>
        <BranchPicker />
      </section>

      <section className="l-section" id="l-how">
        <div className="l-kicker">Så funkar det</div>
        <h2>Sex steg till rätt partner</h2>
        <p className="l-section-sub">Recruitable ersätter inte samtalet med bemanningsbolaget — det ser bara till att ni bara behöver ha det samtalet med de som faktiskt är relevanta.</p>
        <div className="steps-row">
          <div className="step-card">
            <div className="step-num"><span className="box-num">1</span>Yrke</div>
            <h4>Välj yrke</h4>
            <p>Välj yrkesområde och sedan yrke — precis som på Arbetsförmedlingens &ldquo;Hitta yrken&rdquo; (industriell tillverkning, bygg och anläggning, transport, installation/drift/underhåll).</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">2</span>Ort</div>
            <h4>Välj ort</h4>
            <p>Välj bland alla Sveriges 21 län, och sedan bland de kommuner som hör till länet — så matchas ni mot bolag med kontor nära er.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">3</span>Villkor</div>
            <h4>Kollektivavtal &amp; prisintervall</h4>
            <p>Ange ert eget kollektivavtal (IF Metall eller Unionen) och vilket timpris ni söker, så vet bolagen direkt om det matchar.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">4</span>Uppdrag</div>
            <h4>Uppdragstyp &amp; start</h4>
            <p>Långsiktigt eller kortsiktigt, heltid eller extra — och när uppdraget förväntas dra igång.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">5</span>Förfrågan</div>
            <h4>Skicka förfrågan</h4>
            <p>Bocka ur de bolag ni inte vill kontakta, och skicka sedan förfrågan till resten direkt via Recruitable.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">6</span>Svar</div>
            <h4>Återkoppling</h4>
            <p>Se vilka bolag som är aktuella och vill veta mer om ert behov — och vilka som tackar nej.</p>
          </div>
        </div>
        <Link className="btn-lg primary" style={{ marginTop: 32 }} href="/matcha">Prova flödet (demo) →</Link>
      </section>

      <div className="l-stat-band">
        <div className="l-stat-inner">
          <div className="l-stat"><span className="num">20</span><span className="label">Bolag i registret</span></div>
          <div className="l-stat"><span className="num">4</span><span className="label">Fokusområden</span></div>
          <div className="l-stat"><span className="num">12/20</span><span className="label">Med kollektivavtal</span></div>
          <div className="l-stat"><span className="num">1973</span><span className="label">Äldsta etableringsåret</span></div>
        </div>
      </div>

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
        <Link className="btn-lg primary" href="/bolag">Se alla 20 bolag →</Link>
      </section>

      <section className="l-section tight">
        <div className="l-cta-band">
          <div>
            <h3>Redo att sålla bland Västra Götalands bemanningsbolag?</h3>
            <p>Filtrera på bransch och gå vidare till rätt bolags egen webbplats — direkt.</p>
          </div>
          <Link className="btn-lg primary" href="/bolag">Kom igång</Link>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>RECRUITABLE — BEMANNING &amp; REKRYTERING I VÄSTRA GÖTALAND</div>
          <div>Data kontrollerad juli 2026 · Prototyp</div>
        </div>
      </footer>
    </div>
  );
}
