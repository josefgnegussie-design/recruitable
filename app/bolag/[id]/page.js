import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { hamtaBolagMedId, hamtaBolagMedSlug } from "@/lib/companiesRepo";
import { arId } from "@/lib/slug";
import { betyg } from "@/components/CompanyFacts";
import Bildspel from "@/components/Bildspel";
import Faktalista from "@/components/Faktalista";

export const revalidate = 300;

// Inga profilsidor byggs i förväg. Med 59 bolag gick det an, men registret ska
// rymma ett par tusen — då blir det lika många sidor att bygga vid varje
// driftsättning, och ett nytt bolag skulle inte synas förrän nästa bygge.
// I stället byggs varje sida vid första besöket och sparas i fem minuter, så
// att ett godkänt bolag har en profil direkt.
export function generateStaticParams() {
  return [];
}

export default async function ProfilePage({ params }) {
  const { id } = await params;

  // Parametern är antingen ett id eller en slug, och formen avgör vilket. Att
  // prova det ena och sedan det andra hade gjort två databasfrågor av varje
  // sidvisning.
  const c = arId(id) ? await hamtaBolagMedId(id) : await hamtaBolagMedSlug(id);
  if (!c) notFound();

  // Nås profilen via sitt id skickas besökaren vidare till slugen. Gamla länkar
  // och bokmärken fortsätter fungera, men bara en adress är den riktiga — annars
  // cachas varje profil i två versioner och sökmotorerna får två sidor med
  // samma innehåll att välja mellan. Permanent, så att omdirigeringen ärvs.
  if (arId(id) && c.slug) permanentRedirect(`/bolag/${c.slug}`);

  // Sidan gjorde tidigare en andra hämtning här för den utökade premiumprofilen
  // (omslagsbild, mission, historia, erfarenhet, medarbetare) med en Redis-kopia
  // som reservväg. De fälten finns inte längre, och allt sidan visar kommer nu
  // ur hamtaBolagMedId ovan — en databasrundtur mindre per profilvisning.
  // Har vänsterspalten något att visa alls? Bildspelet räknas — ett bolag som
  // laddat upp bilder men inte skrivit något ska inte få dem hopklämda i en
  // enspaltsvy avsedd för en tom vänsterspalt.
  const harText = Boolean(c.vision || c.desc || c.verksamhetsbeskrivning || c.slideshow?.length);

  return (
    <div id="view-profile">
      <Link className="back-link" href="/rekrytera">&larr; Tillbaka till sökningen</Link>
      {!c.claimed && (
        <div className="claim-banner">
          <p>
            <strong>Den här profilen är sammanställd ur offentliga register.</strong> Uppgifterna kommer
            från Bolagsverket och årsredovisningar — bolaget har inte själv fyllt i något här.
          </p>
          <Link className="qs-btn" href="/for-bolag/registrera">
            Är detta ert bolag? Ta över profilen
          </Link>
        </div>
      )}
      <div className="profile-wrap">
        <div className="profile-head">
          <div className="profile-ident">
            {c.logo && <img src={c.logo} alt="" className="profile-logo" />}
            <div>
              <h2>{c.name}</h2>
              <div className="sub">{(c.officeCities?.length > 1 ? "Flera orter" : c.city).toUpperCase()} · GRUNDAT {c.founded}</div>
              <div className="tags">
                {c.focus.concat(c.services).map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="profile-actions">
            {c.link ? (
              <a className="btn btn-primary" href={c.link} target="_blank" rel="noopener noreferrer">Besök webbplats</a>
            ) : (
              <span className="note">Ingen webbplats verifierad</span>
            )}
          </div>
        </div>

        <div className="spec-grid">
          <div className="spec-cell">
            <div className="k">Omsättning</div>
            <div className="v">{c.revenue}</div>
            <div className="y">Räkenskapsår {c.revenueYear}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Medarbetare</div>
            <div className="v">{c.employees}</div>
            <div className="y">Räkenskapsår {c.employeesYear}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Kollektivavtal</div>
            <div className="v">{c.ka ? "Ja" : "Nej"}</div>
          </div>
          <div className="spec-cell">
            <div className="k">Grundat</div>
            <div className="v">{c.founded}</div>
          </div>
        </div>

        {/* Saknar bolaget både vision, beskrivning och verksamhetstext blir
            vänsterspalten tom, och Snabbfakta hamnar ensam bredvid ett stort
            hål. Då används en spalt i stället för två. */}
        <div className={`profile-body${harText ? "" : " single"}`}>
          <div>
            {/* Bild och vision står bredvid varandra när båda finns. Bilden är
                halv spaltbredd, och ensam på sin rad lämnade den ett lika stort
                hål bredvid sig — visionen är kort nog att fylla det och hör
                ändå ihop med bilden som bolagets egen presentation. Saknas den
                ena faller den andra tillbaka på full bredd. Bildpanelen är
                avsiktligt utan rubrik: en bild behöver ingen etikett som säger
                att den är en bild. */}
            <div className={`profil-inledning${c.slideshow?.length && c.vision ? " delad" : ""}`}>
              {c.slideshow?.length > 0 && (
                <div className="panel panel-bilder">
                  <Bildspel bilder={c.slideshow} namn={c.name} />
                </div>
              )}
              {c.vision && (
                <div className="panel panel-vision">
                  <h3>Vision</h3>
                  <p className="vision-quote">&ldquo;{c.vision}&rdquo;</p>
                </div>
              )}
            </div>
            {c.desc && (
              <div className="panel">
                <h3>Om bolaget</h3>
                <p>{c.desc}</p>
              </div>
            )}
            {/* Bolagets egen formulering ur bolagsordningen. Formell, men sann och
                hämtad från bolaget självt — till skillnad från en text vi skrivit
                åt dem. Visas bara när ingen egen beskrivning finns. */}
            {!c.desc && c.verksamhetsbeskrivning && (
              <div className="panel">
                <h3>Verksamhet</h3>
                <p>{c.verksamhetsbeskrivning}</p>
                <p className="note">Enligt bolagsordningen, registrerad hos Bolagsverket.</p>
              </div>
            )}

            {/* Adresserna bolaget självt lagt in. Den äldre fritextkolumnen
                companies.address finns kvar för de tusentals profiler som
                hämtats ur register — där ligger flera adresser hopklämda i en
                sträng åtskilda med semikolon. Har bolaget tagit över profilen
                och lagt in strukturerade adresser visas de i stället.

                Kontoren står i den breda spalten och inte i sidokolumnen: som en
                lodrät lista av fyra orter i en smal spalt blev de en trehundra
                pixlar hög stapel, samtidigt som textspalten tog slut långt före
                sidokolumnen och lämnade ett stort tomrum. Bredvid varandra fyller
                de raden och väger upp sidan. */}
            {c.addresses?.length > 0 && (
              <div className="panel">
                <h3>Kontor</h3>
                <div className="adress-rutnat">
                  {c.addresses.map((a, i) => (
                    // Gata och postnummer på en rad. Orten stod tidigare två
                    // gånger — som rubrik och en gång till efter postnumret —
                    // och varje kontor tog tre rader av mest upprepning.
                    <div className="adress-post" key={`${a.city}-${i}`}>
                      <span className="adress-ort">{a.city}</span>
                      {(a.street || a.postal_code) && (
                        <span className="adress-gata">
                          {[a.street, a.postal_code].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="panel">
              <h3>Snabbfakta</h3>
              {/* Etiketten står ovanför värdet och inte bredvid det: högerställd
                  text i en smal spalt bröt varje lista i en ojämn trappa, och
                  panelen blev sidans längsta stycke i stället för dess snabbaste.
                  Faktalista visar fem värden och lägger resten bakom en knapp. */}
              <div className="side-fact staplad">
                <span className="k">Orter</span>
                {c.officeCities?.length ? (
                  <Faktalista varden={c.officeCities} />
                ) : (
                  <span className="v">{c.address}</span>
                )}
              </div>
              <div className="side-fact staplad">
                <span className="k">Fokusområden</span>
                {c.focus.length ? <Faktalista varden={c.focus} /> : <span className="v">Ej specificerat</span>}
              </div>
              <div className="side-fact staplad">
                <span className="k">Tjänster</span>
                {c.services.length ? <Faktalista varden={c.services} /> : <span className="v">Ej specificerat</span>}
              </div>
              {/* Rollerna anges av bolaget självt och finns bara på övertagna
                  profiler — därför tyst utelämnade i stället för "Ej specificerat",
                  som här skulle läsas som att bolaget svarat att de inte rekryterar
                  något. */}
              {c.recruitingRoles?.length > 0 && (
                <div className="side-fact staplad">
                  <span className="k">Yrkesroller</span>
                  <Faktalista varden={c.recruitingRoles} />
                </div>
              )}
              {/* Notisen måste säga sanningen om just den här profilen. Den
                  ursprungliga texten lovade att bolagets webbplats kontrollerats,
                  vilket stämmer för de dryga femtio som gåtts igenom för hand —
                  men inte för de tusentals som hämtats maskinellt ur register. */}
              {c.klassificeringHarledd ? (
                <div className="note">
                  Fokusområden och tjänster är härledda ur bolagsordningen, inte lämnade av bolaget.
                  Ungefär ett bolag av fjorton får en inriktning som inte stämmer helt — stämmer det
                  inte här, ta över profilen och rätta den.
                </div>
              ) : c.desc ? (
                <div className="note">
                  Källa: offentlig bolagsdata (Allabolag/Ratsit/Bolagsfakta) + bolagets webbplats,
                  kontrollerad augusti 2026.
                </div>
              ) : (
                <div className="note">
                  Uppgifterna kommer från Bolagsverket och offentliga årsredovisningar. Bolaget har
                  inte lämnat några uppgifter själv.
                </div>
              )}
            </div>

            {/* Undersökningarna låg tidigare i premiumavsnittet, och dessutom
                inuti villkoret för mission/historia/erfarenhet — ett bolag som
                bara fyllt i sina mätvärden fick dem aldrig visade. De redigeras
                numera av alla bolag och hör hemma bland de jämförbara fakta
                kunden väljer leverantör utifrån. */}
            {(c.surveys?.customer_satisfaction || c.surveys?.employee_satisfaction) && (
              <div className="panel">
                <h3>Undersökningar</h3>
                {c.surveys.customer_satisfaction && (
                  <>
                    <div className="side-fact">
                      <span className="k">Kundnöjdhet</span>
                      <span className="v">{betyg(c.surveys.customer_satisfaction.score)} / 5</span>
                    </div>
                    {c.surveys.customer_satisfaction.source && (
                      <div className="note">Källa: {c.surveys.customer_satisfaction.source}</div>
                    )}
                  </>
                )}
                {c.surveys.employee_satisfaction && (
                  <>
                    <div className="side-fact" style={{ marginTop: 10 }}>
                      <span className="k">Medarbetarnöjdhet</span>
                      <span className="v">{betyg(c.surveys.employee_satisfaction.score)} / 5</span>
                    </div>
                    {c.surveys.employee_satisfaction.source && (
                      <div className="note">Källa: {c.surveys.employee_satisfaction.source}</div>
                    )}
                  </>
                )}
                <div className="note">Mätningarna är bolagets egna och redovisas med den källa de angett.</div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
