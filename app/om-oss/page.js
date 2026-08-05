import Link from "next/link";

const FAQ = [
  {
    q: "Varifrån kommer uppgifterna om bolagen?",
    a: "Från offentlig bolagsdata (Bolagsverket, via bland annat Allabolag, Ratsit och Bolagsfakta) samt respektive bolags egna webbplatser. Varje bolagsprofil visar när informationen senast kontrollerades.",
  },
  {
    q: "Rangordnar eller rekommenderar ni bolag?",
    a: "Nej. Vi tar inte ställning för enskilda bolag och har inga kommersiella relationer som påverkar vilken data som visas. Alla bolag presenteras utifrån samma datapunkter — det är ni som avgör vad som passar er verksamhet.",
  },
  {
    q: "Vilka bolag ingår i registret?",
    a: "Bemannings- och rekryteringsföretag verksamma i Sverige, inom allt fler branscher och yrkesområden i takt med att registret växer.",
  },
  {
    q: "Hur ofta uppdateras informationen?",
    a: "Vi kontrollerar och kompletterar uppgifterna löpande. Datumet för senaste kontroll anges längst ner på varje sida.",
  },
  {
    q: "Kan vårt bolag bli listat i registret?",
    a: (
      <>
        Om ni är ett bemannings- eller rekryteringsföretag som vill bli en del av registret, hör gärna av er på{" "}
        <a href="mailto:info@recruitable.se">info@recruitable.se</a>.
      </>
    ),
  },
];

export default function OmOssPage() {
  return (
    <div id="view-om-oss">
      <section className="about-hero">
        <div className="l-kicker">Om Recruitable</div>
        <h1>Rätt val av en ny rekryteringspartner sker inte av en slump.</h1>
        <p className="about-hero-lead">
          Gör er research via Recruitable och initiera era dialoger med tänkbara partners mer effektivt — täck
          era behov, på era villkor, mer träffsäkert!
        </p>
      </section>

      <div className="vision-block">
        <div className="l-kicker">Vår vision</div>
        <p>
          Med Recruitable jämnas oddsen i rekryteringsbranschen ut med syfte att motivera marknaden att
          leverera högsta möjliga värde till kunderna.
        </p>
      </div>

      <section className="l-section">
        <div className="l-kicker">Vår idé</div>
        <h2>Varför Recruitable finns</h2>
        <p className="l-section-sub">
          Att välja bemannings- eller rekryteringspartner är ett beslut med stora konsekvenser — för både
          kostnad och kvalitet. Ändå görs det ofta utifrån för lite information.
        </p>
        <div className="idea-grid">
          <div className="idea-cell">
            <div className="idea-mark">// Problemet</div>
            <h4>Beslutet tas för tidigt</h4>
            <p>
              De flesta arbetsgivare väljer partner utifrån hur ett första möte känns, snarare än utifrån vad
              marknaden faktiskt har att erbjuda. Det gör det svårt att veta om ni har hittat rätt bolag — eller
              bara det första ni pratade med.
            </p>
          </div>
          <div className="idea-cell">
            <div className="idea-mark">// Lösningen</div>
            <h4>All information på ett ställe</h4>
            <p>
              Recruitable samlar uppgifter om verksamma bemannings- och rekryteringsföretag i Sverige — omsättning,
              storlek, kollektivavtal, auktorisation och fokusområden — så att ni kan jämföra innan ni tar första
              kontakten.
            </p>
          </div>
          <div className="idea-cell">
            <div className="idea-mark">// Resultatet</div>
            <h4>Träffsäkrare partnerskap</h4>
            <p>
              Med bättre underlag blir matchningen bättre. Resultatet är partners med rätt engagemang, och mindre
              tid och pengar som går åt till möten som ändå inte leder någonstans.
            </p>
          </div>
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-kicker">Så fungerar det</div>
        <h2>Tre steg till rätt partner</h2>
        <div className="steps-row cols-3">
          <div className="step-card">
            <div className="step-num"><span className="box-num">1</span>Filtrera</div>
            <h4>Sätt era villkor</h4>
            <p>Välj stad, bransch, storlek, kollektivavtal och auktorisation — och se bara de bolag som faktiskt matchar.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">2</span>Jämför</div>
            <h4>Se allt sida vid sida</h4>
            <p>Omsättning, antal medarbetare, Google-betyg och villkor — samlat på ett och samma ställe.</p>
          </div>
          <div className="step-card">
            <div className="step-num"><span className="box-num">3</span>Gå vidare</div>
            <h4>Ta första kontakten själva</h4>
            <p>Kontakta rätt bolag direkt via deras egen webbplats — utan mellanhänder.</p>
          </div>
        </div>
        <Link className="btn-lg primary" style={{ marginTop: 32 }} href="/matcha">Utforska hela flödet →</Link>
      </section>

      <section className="l-section">
        <div className="l-kicker">Vanliga frågor</div>
        <h2>Frågor och svar</h2>
        <div className="faq-list">
          {FAQ.map((item) => (
            <div className="faq-item" key={item.q}>
              <p className="faq-q">{item.q}</p>
              <p className="faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section tight">
        <div className="l-cta-band">
          <div>
            <h3>Redo att se vad marknaden faktiskt erbjuder?</h3>
            <p>Filtrera fram de bolag som matchar era villkor — och gå vidare direkt.</p>
          </div>
          <Link className="btn-lg primary" href="/bolag">Utforska registret</Link>
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
