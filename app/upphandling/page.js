import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaOppnaUpphandlingar } from "@/lib/upphandlingRepo";
import UpphandlingLista from "@/components/upphandling/UpphandlingLista";

// Läses vid varje besök: en upphandling ska försvinna ur listan samma dag som
// sista dagen passerat, och synas så snart den är godkänd.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upphandling — Recruitable",
  description:
    "Beskriv vad ni ska upphandla inom bemanning eller rekrytering och se direkt vilka bolag som kan leverera på era orter.",
};

// Stegen följer formuläret: matchningen kommer före publiceringen. Köparen ska
// se vilka bolag som finns innan hen lägger tid på tidplan och kontaktuppgifter.
const STEG = [
  {
    rubrik: "Beskriv behovet",
    text: "Välj tjänst, bransch och yrkesområden, orter och kompetenser. Det tar en minut.",
  },
  {
    rubrik: "Se relevanta bolag direkt",
    text: "Medan ni fyller i visas bolagen i registret som finns på eller nära era orter, och vilka krav de uppfyller enligt sin profil.",
  },
  {
    rubrik: "Publicera och få intresse",
    text: "Lägg till krav och tidplan. Efter granskning får matchande bolag besked, anmäler vad de kan täcka och ni väljer vilka ni går vidare med.",
  },
];

export default async function UpphandlingPage() {
  const { lista, otillganglig } = await hamtaOppnaUpphandlingar(createAdminClient());

  return (
    <div id="view-upphandling">
      <section className="hero" style={{ gridTemplateColumns: "1fr" }}>
        <div>
          <div className="eyebrow">För köpare och leverantörer</div>
          <h1 className="hero-title">Upphandling</h1>
          <p className="hero-sub" style={{ maxWidth: "62ch" }}>
            Beskriv vad ni ska köpa och var det ska levereras, så tar vi fram de bemannings- och rekryteringsbolag som
            är relevanta för just er bransch, ert behov och era orter. Ni ser direkt om marknaden räcker till innan ni
            går vidare.
          </p>
          <div className="upp-knappar">
            <Link className="btn-lg primary" href="/upphandling/skapa">Hitta bolag för er upphandling</Link>
            <Link className="btn-lg secondary" href="/mina-sidor/upphandling">Anmäl intresse som leverantör</Link>
          </div>
        </div>
      </section>

      <div className="upp-sida">
        <ol className="upp-steg">
          {STEG.map((s, i) => (
            <li className="step-card" key={s.rubrik}>
              <div className="step-num"><span className="box-num">{i + 1}</span></div>
              <h2>{s.rubrik}</h2>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>

        <UpphandlingLista lista={lista} otillganglig={otillganglig} />
      </div>
    </div>
  );
}
