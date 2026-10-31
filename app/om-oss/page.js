import Link from "next/link";

export const metadata = {
  title: "Om oss",
  description:
    "Recruitable samlar Sveriges bemannings- och rekryteringsbolag på ett ställe, så att det går att jämföra dem och hitta rätt partner.",
  alternates: { canonical: "/om-oss" },
};

const FAQ = [
  {
    q: "Varifrån kommer uppgifterna om bolagen?",
    a: "Från offentlig bolagsdata (Bolagsverket, via bland annat Allabolag, Ratsit och Bolagsfakta) samt respektive bolags egna webbplatser. Orter och koordinater bygger på GeoNames postnummerregister (CC BY 4.0). Varje bolagsprofil visar när informationen senast kontrollerades.",
  },
  {
    q: "Rangordnar eller rekommenderar ni bolag?",
    a: "Nej. Vi tar inte ställning för enskilda bolag och har inga kommersiella relationer som påverkar vilken data som visas. Alla bolag presenteras utifrån samma uppgifter, och det är ni som avgör vad som passar er verksamhet.",
  },
  {
    q: "Vilka bolag ingår i registret?",
    a: "Bemannings- och rekryteringsbolag verksamma i Sverige, inom allt fler branscher och yrkesområden i takt med att registret växer.",
  },
  {
    q: "Hur ofta uppdateras informationen?",
    a: "Vi kontrollerar och kompletterar uppgifterna löpande. Datumet för senaste kontroll anges längst ner på varje sida.",
  },
  {
    q: "Kan vårt bolag bli listat i registret?",
    a: (
      <>
        Om ni är ett bemannings- eller rekryteringsbolag som vill bli en del av registret går det bra att{" "}
        <Link href="/for-bolag/registrera">skapa konto</Link>.
      </>
    ),
  },
];

// Om oss berättar varför tjänsten finns. Stegen för hur den används står på
// startsidan och upprepas inte här, och visionen är ett citat i texten i
// stället för en mörk ruta med centrerad fetstil.
export default function OmOssPage() {
  return (
    <div id="view-om-oss">
      <section className="about-hero">
        <div className="l-kicker">Om Recruitable</div>
        <h1>Rätt rekryteringspartner hittar man inte av en slump</h1>
        <p className="about-hero-sub">
          Med Recruitable gör ni researchen innan första mötet. Ni ser vilka bolag som finns, vad de erbjuder
          och på vilka villkor, och tar kontakt med dem som faktiskt passar.
        </p>
      </section>

      <section className="l-section l-split">
        <h2>Varför Recruitable finns</h2>
        <div className="l-prosa">
          <p>
            Att välja bemannings- eller rekryteringspartner påverkar både kostnad och kvalitet under lång tid.
            Ändå görs valet ofta på för lite information.
          </p>
          <p>
            De flesta arbetsgivare väljer utifrån hur ett första möte känns, inte utifrån vad marknaden har att
            erbjuda. Då är det svårt att veta om man hittat rätt bolag eller bara det första man pratade med.
          </p>
          <p>
            Recruitable samlar uppgifter om de bemannings- och rekryteringsbolag som är verksamma i Sverige:
            omsättning, storlek, kollektivavtal, auktorisation och vilka områden de arbetar inom. Ni kan jämföra
            innan ni tar kontakt, och lägger mindre tid på möten som inte leder någonstans.
          </p>
          <blockquote className="l-citat">
            Vår vision är att jämna ut oddsen i rekryteringsbranschen, så att bolagen konkurrerar om att ge
            kunderna mest möjliga värde.
          </blockquote>
        </div>
      </section>

      <section className="l-section l-split">
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

      <section className="l-section l-section-sist">
        <div className="l-strip">
          <div>
            <h3>Se vad marknaden erbjuder</h3>
            <p>Filtrera fram de bolag som matchar era villkor och skicka en förfrågan direkt.</p>
          </div>
          <Link className="btn-lg primary" href="/rekrytera">Utforska registret</Link>
        </div>
      </section>
    </div>
  );
}
