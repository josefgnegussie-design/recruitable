import Link from "next/link";
import { notFound } from "next/navigation";
import { hamtaBolagMedSlug } from "@/lib/companiesRepo";

export const revalidate = 300;

// Inbjudningssidan som mejlet till ett bolag länkar till.
//
// Varför en egen sida i stället för en länk rakt till registreringen: det
// starkaste argumentet vi har är inte texten i mejlet, utan att bolaget klickar
// och ser sin egen profil ligga där — med omsättning, orter och konkurrenterna
// bredvid. Ett tomt formulär ber dem värdera något de inte fått se.
//
// Sidan är adresserad till ett bestämt bolag, men medvetet inte hemlig. En länk
// som måste hållas hemlig blir en länk som inte går att vidarebefordra internt,
// och det första en mottagare gör är att skicka den till den som faktiskt äger
// frågan. Ingenting här är känsligt: allt står redan på den publika profilen.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const bolag = await hamtaBolagMedSlug(slug);
  if (!bolag) return { title: "Recruitable" };

  return {
    title: `${bolag.name} på Recruitable`,
    description: `${bolag.name} finns i Recruitables register. Ta över profilen och ta emot förfrågningar från företag som söker bemanning och rekrytering.`,
    // Inbjudningar ska inte indexeras: de är adresserade till ett bolag och hör
    // inte hemma i sökresultat. Profilen är den publika sidan.
    robots: { index: false, follow: false },
  };
}

// Spec-rutan delar utseende med profilsidan, men inte antal celler: där är de
// alltid fyra, här beror de på vad registret råkar veta om just det här bolaget.
// En saknad cell i ett rutnät med fast kolumnantal blir ett grått hål, eftersom
// bakgrunden är det som ritar linjerna mellan cellerna — därför sätts antalet
// kolumner efter hur många celler som faktiskt finns.
function faktaFor(c) {
  return [
    c.revenue && { etikett: "Omsättning", varde: c.revenue, ar: c.revenueYear },
    c.employees && { etikett: "Medarbetare", varde: c.employees, ar: c.employeesYear },
    { etikett: "Kollektivavtal", varde: c.ka ? "Ja" : "Nej" },
    c.orgNumber && { etikett: "Organisationsnummer", varde: c.orgNumber },
  ].filter(Boolean);
}

export default async function ValkommenPage({ params }) {
  const { slug } = await params;
  const c = await hamtaBolagMedSlug(slug);

  if (!c) notFound();

  // Ett upphört bolag ska inte bjudas in. Profilen finns kvar och berättar vad
  // som hänt, men det finns ingen verksamhet att ta över.
  if (c.retiredAt) notFound();

  const orter = c.officeCities?.length ? c.officeCities : [c.city].filter(Boolean);
  const taggar = [...(c.focus || []), ...(c.services || [])];
  const fakta = faktaFor(c);

  return (
    <div id="view-valkommen">
      <section className="valkommen-hero">
        <div className="eyebrow">Inbjudan till {c.name}</div>
        <h1 className="hero-title">Ert bolag finns redan på Recruitable</h1>
        <p className="hero-sub">
          Recruitable är ett öppet register där företag jämför bemannings- och rekryteringsbolag och
          skickar förfrågningar direkt till dem. <strong>{c.name}</strong> finns med — profilen nedan är
          sammanställd ur offentliga källor, och den syns redan i sökningen i dag.
        </p>
        <p className="hero-sub">
          Nu kan ni ta över den. Det kostar ingenting, och det är ni som vet vad som ska stå där.
        </p>
      </section>

      {/* Deras egen profil, som den ser ut för en köpare just nu. Det här är
          beviset, och därför ligger det före erbjudandet. */}
      <section className="valkommen-kort">
        <div className="profile-head">
          <div className="profile-ident">
            {c.logo && <img src={c.logo} alt="" className="profile-logo" />}
            <div>
              <h2>{c.name}</h2>
              <div className="sub">
                {orter.join(" · ").toUpperCase()}
                {c.founded ? ` · GRUNDAT ${c.founded}` : ""}
              </div>
              {taggar.length > 0 && (
                <div className="tags">
                  {taggar.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="profile-actions">
            <Link className="btn btn-ghost" href={`/bolag/${c.slug}`}>
              Se profilen som den syns i dag
            </Link>
          </div>
        </div>

        {fakta.length > 0 && (
          <div
            className="spec-grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(fakta.length, 4)}, 1fr)` }}
          >
            {fakta.map((f) => (
              <div className="spec-cell" key={f.etikett}>
                <div className="k">{f.etikett}</div>
                <div className="v">{f.varde}</div>
                {f.ar && <div className="y">Räkenskapsår {f.ar}</div>}
              </div>
            ))}
          </div>
        )}

        {!c.desc && (
          <p className="note valkommen-tomt">
            Profilen saknar beskrivning, vision och yrkesroller. Det är sådant bara ni kan fylla i — och
            det är skillnaden mellan en rad i ett register och ett bolag en köpare hör av sig till.
          </p>
        )}
      </section>

      {/* Erbjudandet efter beviset. Vad de får, vad det kostar, vad som krävs. */}
      <section className="valkommen-erbjudande">
        <h2 className="admin-h2">Vad ni får</h2>
        <ul className="valkommen-lista">
          <li>
            <strong>Förfrågningar från företag som söker er tjänst.</strong> Den som söker bemanning i er
            ort och ert yrkesområde ser er i resultatet och kan skicka en förfrågan direkt.
          </li>
          <li>
            <strong>Profilen i era egna ord.</strong> Beskrivning, vision, yrkesområden, yrkesroller,
            bilder, logotyp och de orter ni faktiskt finns på.
          </li>
          <li>
            <strong>Era uppgifter, rättade.</strong> Det som står nu kommer från Bolagsverket och
            årsredovisningar. Stämmer något inte är det ni som kan säga det.
          </li>
        </ul>

        <h2 className="admin-h2">Vad det kostar</h2>
        <p>
          Att ta över profilen och fylla i den är <strong>gratis</strong>, och förblir det. Vi tar betalt
          först när en förfrågan leder någonstans — ni ser vad den gäller innan ni bestämmer er för att
          svara.
        </p>

        <h2 className="admin-h2">Så går det till</h2>
        <ol className="valkommen-steg">
          <li>
            <strong>Registrera er</strong> med en mejladress på bolagets egen domän. Den måste matcha
            webbplatsen — det är så vi vet att det är ni.
          </li>
          <li>
            <strong>Vi granskar</strong> ansökan för hand, oftast samma dag.
          </li>
          <li>
            <strong>Ni fyller i profilen</strong> och börjar ta emot förfrågningar.
          </li>
        </ol>

        {/* En inbjudan kan nå ett bolag som redan hunnit registrera sig — en
            kollega hann före, eller mejlet lästes sent. Att då visa "Ta över"
            leder till en ansökan som bara blir avslagen. */}
        {c.claimed ? (
          <div className="valkommen-cta">
            <p>
              <strong>Profilen är redan övertagen.</strong> Någon hos er har registrerat sig — logga in
              för att fylla i den och se era förfrågningar.
            </p>
            <Link className="qs-btn" href="/logga-in">
              Logga in
            </Link>
            <p className="note">
              Vet ni inte vem det är? Skriv till{" "}
              <a href="mailto:info@recruitable.se">info@recruitable.se</a> så reder vi ut det.
            </p>
          </div>
        ) : (
          <div className="valkommen-cta">
            <Link className="qs-btn" href={`/for-bolag/registrera?bolag=${c.slug}`}>
              Ta över {c.name}
            </Link>
            <p className="note">
              Bolagsuppgifterna är redan ifyllda åt er. Frågor? Skriv till{" "}
              <a href="mailto:info@recruitable.se">info@recruitable.se</a>.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
