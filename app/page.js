import Link from "next/link";
import { hamtaSenasteNyheter } from "@/lib/branschnyheterRepo";
import { hamtaKoordinater, hamtaUrval, raknaBolag } from "@/lib/companiesRepo";
import NearbyCompanies from "@/components/NearbyCompanies";
import PreviewCompanies from "@/components/PreviewCompanies";
import Registerkarta from "@/components/Registerkarta";

export const metadata = { alternates: { canonical: "/" } };

export const revalidate = 300;

// Startsidan är byggd för att läsas uppifrån och ner som en sida, inte som en
// rad lådor. Förut låg nästan varje sektion i likadana vita kort med samma
// etikett ovanför rubriken — ett mönster så vanligt att sidan såg mallgjord
// ut. Nu bär kartan över registret toppen, problemen och stegen är löptext
// och en numrerad rad, och kort används bara där innehållet faktiskt är
// klickbara objekt: bolagen.
const STEG = [
  {
    rubrik: "Beskriv rollen",
    text: "Ange yrkesområde, tjänst och ort. Ni behöver inget konto. Skriv gärna några rader om vad ni specifikt söker.",
  },
  {
    rubrik: "Se vilka bolag som passar",
    text: "Bolagen som matchar visas i en lista, med omsättning, kollektivavtal och auktorisation synligt direkt.",
  },
  {
    rubrik: "Skicka en förfrågan",
    text: "Välj de bolag ni vill höra från och beskriv behovet. Förfrågan går direkt till dem.",
  },
  {
    rubrik: "Bolagen hör av sig",
    text: "De bolag ni valt kontaktar er. Ni bestämmer själva vem ni går vidare med.",
  },
];

export default async function LandingPage() {
  const [urval, punkter, antalBolag, nyheter] = await Promise.all([
    hamtaUrval(3),
    hamtaKoordinater(),
    raknaBolag(),
    hamtaSenasteNyheter(),
  ]);

  return (
    <div id="view-landing">
      <section className="l-hero">
        <div className="l-hero-text">
          <div className="l-kicker">Bemanning &amp; rekrytering · Sverige</div>
          <h1>Beskriv rollen och hitta rätt partner</h1>
          <p className="l-hero-sub">
            Recruitable samlar Sveriges bemannings- och rekryteringsbolag på ett ställe. Berätta vad ni söker,
            se vilka bolag som passar och skicka en förfrågan till dem ni vill prata med.
          </p>
          <div className="l-cta-row">
            <Link className="btn-lg primary" href="/rekrytera">Hitta bolag</Link>
            <a className="btn-lg text" href="#sa-funkar-det">Så funkar det</a>
          </div>
        </div>
        <Registerkarta punkter={punkter} antalBolag={antalBolag} />
      </section>

      <section className="l-section l-split">
        <h2>Varför det är svårt att välja partner</h2>
        <div className="l-prosa">
          <p>
            <strong>Många låter likadant.</strong> Bemanningsbolag, rekryteringsbolag och interimsbyråer
            beskriver sig själva på nästan samma sätt. Det är svårt att se vem som faktiskt passar er
            verksamhet.
          </p>
          <p>
            <strong>Villkoren syns för sent.</strong> Kollektivavtal, auktorisation och hur stor
            konsultstocken är avgör om ett samarbete fungerar. Ändå får ni oftast veta det först när ni redan
            har börjat prata.
          </p>
          <p>
            <strong>Mötena tar tid.</strong> Introduktionsmöten med bolag som ändå inte passar är den dyraste
            delen av att hitta rätt.
          </p>
        </div>
      </section>

      <section className="l-section" id="sa-funkar-det">
        <h2>Så funkar det</h2>
        <ol className="steg-lista">
          {STEG.map((s) => (
            <li key={s.rubrik}>
              <h3>{s.rubrik}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
        <Link className="btn-lg primary" href="/rekrytera">Beskriv er roll</Link>
      </section>

      <section className="l-section">
        <h2>Hitta bolag nära er</h2>
        <p className="l-section-sub">
          Skriv in er adress, så listar vi bolagen i registret från närmast till längst bort.
        </p>
        <NearbyCompanies />
      </section>

      <section className="l-section">
        <h2>Några bolag i registret</h2>
        <p className="l-section-sub">Ett slumpat urval bland de bolag som har fyllt i sin profil.</p>
        <PreviewCompanies bolag={urval} />
      </section>

      <section className="l-section">
        <h2>Från branschen</h2>
        <div className="news-list">
          {nyheter.map((n) => (
            <a className="news-item" href={n.url} target="_blank" rel="noopener noreferrer" key={n.url}>
              <div className="news-meta">{n.source} · {n.date}</div>
              <div className="news-title">{n.title}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="l-section l-section-sist">
        <div className="l-strip">
          <div>
            <h3>Är ni ett bemannings- eller rekryteringsbolag?</h3>
            <p>Ta över er profil i registret och fyll i det som inte syns i offentliga källor.</p>
          </div>
          <Link className="btn-lg secondary" href="/for-bolag/registrera">Skapa konto</Link>
        </div>
      </section>
    </div>
  );
}
