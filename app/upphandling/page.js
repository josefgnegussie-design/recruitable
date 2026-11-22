import Link from "next/link";
import { hamtaPagaendeUpphandlingar } from "@/lib/pagaendeUpphandlingar";
import PagaendeLista, { pagaendeIntro } from "@/components/PagaendeLista";
import NarliggandeKarta from "@/components/NarliggandeKarta";
import AiSok from "@/components/AiSok";

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
    <>
      {/* Pågående upphandlingar står i ett band direkt under menyn, precis som
          pågående förfrågningar på Rekrytera, så att det första besökaren ser
          är att tjänsten används. Meningarna byggs ur fasta val och aldrig ur
          köparens fritext, se lib/pagaendeUpphandlingar.js. */}
      <div className="pagaende-band">
        <PagaendeLista
          id="upp-pagaende-rubrik"
          rubrik="Pågående upphandlingar"
          intro={pagaendeIntro(pagaende, {
            riktiga: "Ett urval av inbjudningar som skickats via Recruitable. Köparna visas inte.",
            exempel: "Så här visas inbjudningar som skickats via Recruitable, utan köparens namn.",
          })}
          kort={pagaende}
          stegEtikett="Upphandlingens steg"
        />
      </div>
      <div id="view-upphandling">
        <section className="hero upp-hero">
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
            <AiSok lage="upphandling" />
          </div>
          {/* Stegen står bredvid texten i stället för under den, så att toppen
              inte bara fyller vänstra halvan. Numren kommer från steg-lista. */}
          <ol className="steg-lista steg-lista-ruta">
            {STEG.map((s) => (
              <li key={s.rubrik}>
                <h2>{s.rubrik}</h2>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="l-section tight">
          <h2>Vilka bolag finns nära era arbetsställen?</h2>
          <p className="l-section-sub">
            Se vilka bolag som finns där personalen ska arbeta.
          </p>
          <NarliggandeKarta lage="upphandling" />
        </section>
      </div>
    </>
  );
}
