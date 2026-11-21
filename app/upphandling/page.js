import Link from "next/link";
import { hamtaPagaendeUpphandlingar } from "@/lib/pagaendeUpphandlingar";
import { formateraDatum } from "@/lib/upphandlingInbjudan";

// Pågående upphandlingar ändras när en inbjudan godkänns, inte per besök.
export const revalidate = 300;

export const metadata = {
  title: "Upphandling — Recruitable",
  description:
    "Beskriv vad ni ska upphandla inom bemanning eller rekrytering, se direkt vilka bolag som kan leverera på era orter och bjud in dem ni vill prata med.",
};

// Sidan är bara för köpare. Upphandlingar listades tidigare här, och bolagen
// anmälde själva intresse; nu väljer köparen ut bolag och bjuder in dem, och
// inbjudan besvaras som en förfrågan på Mina sidor. Offentlig verksamhet är
// utesluten: deras upphandlingar annonseras enligt LOU och hör inte hemma här.
const STEG = [
  {
    rubrik: "Beskriv behovet",
    text: "Välj tjänst, bransch och yrkesområden, orter och eventuella krav. Det tar en minut.",
  },
  {
    rubrik: "Välj bolag",
    text: "Bolagen som finns på eller nära era orter visas direkt, med vilka krav de uppfyller enligt sin profil. De mest relevanta är förvalda.",
  },
  {
    rubrik: "Skicka en inbjudan",
    text: "Beskriv upphandlingen och skicka. Recruitable granskar inbjudan innan bolagen får den.",
  },
  {
    rubrik: "Bolagen svarar",
    text: "Bolagen tackar ja eller nej. Ni följer svaren på en egen sida, och era kontaktuppgifter går bara till dem som tackar ja.",
  },
];

export default async function UpphandlingPage() {
  const pagaende = await hamtaPagaendeUpphandlingar();

  return (
    <div id="view-upphandling">
      <section className="hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <div className="eyebrow">För företag som ska upphandla</div>
          <h1 className="hero-title">Upphandling</h1>
          <p className="hero-sub" style={{ maxWidth: "62ch" }}>
            Ska ni upphandla bemanning eller rekrytering? Beskriv vad ni behöver och var, så tar vi fram de bolag som är
            relevanta för just er bransch, ert behov och era orter. Välj de som verkar intressanta och bjud in dem. Inget
            konto behövs.
          </p>
          <div className="upp-knappar">
            <Link className="btn-lg primary" href="/upphandling/skapa">Hitta bolag för er upphandling</Link>
          </div>
        </div>
      </section>

      <div className="upp-sida">
        <ol className="upp-steg upp-steg-fyra">
          {STEG.map((s, i) => (
            <li className="step-card" key={s.rubrik}>
              <div className="step-num"><span className="box-num">{i + 1}</span></div>
              <h2>{s.rubrik}</h2>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>

        {/* Visas bara när det finns något att visa. Meningarna byggs ur fasta
            val och aldrig ur köparens fritext, se lib/pagaendeUpphandlingar.js. */}
        {pagaende.length > 0 && (
          <section className="upp-pagaende" aria-labelledby="upp-pagaende-rubrik">
            <h2 id="upp-pagaende-rubrik" className="upp-rubrik-liten">Pågående upphandlingar</h2>
            <p className="upp-not" style={{ marginTop: 0 }}>
              {pagaende.some((u) => !u.exempel)
                ? "Ett urval av inbjudningar som skickats via Recruitable. Köparna visas inte."
                : "Så här visas inbjudningar som skickats via Recruitable, utan köparens namn."}
              {pagaende.some((u) => u.exempel) && pagaende.some((u) => !u.exempel) && " Kort märkta Exempel visar hur det kan se ut."}
            </p>
            <ul className="upp-pagaende-lista">
              {pagaende.map((u, i) => {
                const fakta = [
                  u.inbjudna > 0 && `${u.inbjudna} ${u.inbjudna === 1 ? "bolag inbjudet" : "bolag inbjudna"}`,
                  u.svaraSenast && `Svar senast ${formateraDatum(u.svaraSenast)}`,
                ].filter(Boolean);
                return (
                  <li key={i} className="auth-panel">
                    <div className="upp-pagaende-huvud">
                      {u.exempel && <span className="tag upp-exempel-tagg">Exempel</span>}
                      <h3>{u.rubrik}</h3>
                      {u.orter && <p className="upp-pagaende-ort">{u.orter}</p>}
                    </div>
                    <p className="upp-brod">{u.mening}</p>
                    {fakta.length > 0 && <p className="upp-not">{fakta.join(" · ")}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
