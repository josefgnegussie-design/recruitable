import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaOppnaUpphandlingar } from "@/lib/upphandlingRepo";
import UpphandlingLista from "@/components/upphandling/UpphandlingLista";

// Läses vid varje besök: en upphandling ska försvinna ur listan samma dag som
// sista dagen passerat, och synas så snart den är godkänd.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upphandling",
  description:
    "Lägg ut en upphandling av bemanning eller rekrytering och se direkt vilka leverantörer som kan leverera på era orter.",
  alternates: { canonical: "/upphandling" },
};

const STEG = [
  {
    rubrik: "Beskriv behovet",
    text: "Ange tjänst, kompetenser, orter, krav och tidplan. Recruitable granskar upphandlingen innan den publiceras.",
  },
  {
    rubrik: "Leverantörer visar vad de kan",
    text: "Verifierade bolag anmäler vilka orter och kompetenser de kan leverera och svarar på kraven.",
  },
  {
    rubrik: "Välj vilka ni går vidare med",
    text: "Ni ser täckningen per ort, jämför bolagen och lägger dem som passar på en kortlista.",
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
            Beskriv vad ni ska köpa och var det ska levereras. Bemannings- och rekryteringsbolag visar själva vilka
            orter och kompetenser de kan täcka, så ser ni direkt om marknaden räcker till innan ni går vidare.
          </p>
          <div className="upp-knappar">
            <Link className="btn-lg primary" href="/upphandling/skapa">Lägg ut en upphandling</Link>
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
