import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { hamtaBolagMedId, hamtaBolagMedSlug } from "@/lib/companiesRepo";
import { arId } from "@/lib/slug";
import { betyg } from "@/components/CompanyFacts";
import Bildspel from "@/components/Bildspel";
import Faktalista from "@/components/Faktalista";
import Brodtext from "@/components/Brodtext";
import Sverigekarta from "@/components/Sverigekarta";
import { koordinatForOrt, slaUppPostnummer } from "@/lib/postnummer";

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
  // Nålarna på kartan. Ett kontors postnummer ger en exakt punkt; saknas det får
  // orten sitt medelvärde ur postnummerregistret. Orter registret inte känner —
  // stavfel, utländska kontor — hoppas över: hellre en nål mindre än en nål på
  // fel plats. Ett registerhämtat bolag utan egna kontor får åtminstone sin
  // säteort, annars hade kartan bara funnits för de femtio handresearchade.
  const pinnar = [];
  const settaOrter = new Set();
  const laggTillPin = (namn, koordinat) => {
    const nyckel = typeof namn === "string" ? namn.trim().toLowerCase() : "";
    if (!nyckel || !koordinat || settaOrter.has(nyckel)) return;
    settaOrter.add(nyckel);
    pinnar.push({ namn: namn.trim(), lat: koordinat.lat, lng: koordinat.lng });
  };

  for (const a of c.addresses || []) {
    laggTillPin(a.city, slaUppPostnummer(a.postal_code) || koordinatForOrt(a.city));
  }
  for (const ort of c.officeCities || []) laggTillPin(ort, koordinatForOrt(ort));
  if (!pinnar.length) {
    laggTillPin(c.city, koordinatForOrt(c.city) || (c.lat && c.lng ? { lat: c.lat, lng: c.lng } : null));
  }

  // Sidan är tre segment, och varje segment faller tillbaka på en spalt när dess
  // vänsterhalva är tom — annars står sidokolumnen ensam bredvid ett hål.
  const harUndersokningar = Boolean(
    c.surveys?.customer_satisfaction || c.surveys?.employee_satisfaction
  );
  const harVision = Boolean(c.vision || harUndersokningar);
  const harVerksamhet = Boolean(c.desc || c.verksamhetsbeskrivning || c.addresses?.length);

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

        {/* FÖRSTA SEGMENTET — vad bolaget säger om sig självt, och de mätvärden
            det går att jämföra med andra på. Vision och undersökningar i den
            breda spalten, Snabbfakta bredvid. */}
        <div className={`profile-body${harVision ? "" : " single"}`}>
          <div>
            {c.vision && (
              <div className="panel">
                <h3>Vision</h3>
                <p className="vision-quote">&ldquo;{c.vision}&rdquo;</p>
              </div>
            )}

            {/* Undersökningarna låg tidigare i premiumavsnittet, och dessutom
                inuti villkoret för mission/historia/erfarenhet — ett bolag som
                bara fyllt i sina mätvärden fick dem aldrig visade. De redigeras
                numera av alla bolag och hör hemma bland de jämförbara fakta
                kunden väljer leverantör utifrån. */}
            {harUndersokningar && (
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
          <div>
            <div className="panel">
              <h3>Snabbfakta</h3>
              {/* Etiketten står ovanför värdet och inte bredvid det: högerställd
                  text i en smal spalt bröt varje lista i en ojämn trappa, och
                  panelen blev sidans längsta stycke i stället för dess snabbaste.
                  Faktalista visar fem värden och lägger resten bakom en knapp.

                  Yrkesområdena står inte här: de ligger redan som taggar överst
                  på sidan, och samma uppgift två gånger gör ingen klokare. */}
              <div className="side-fact staplad">
                <span className="k">Orter</span>
                {c.officeCities?.length ? (
                  <Faktalista varden={c.officeCities} />
                ) : (
                  <span className="v">{c.address}</span>
                )}
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
          </div>
        </div>

        {/* ANDRA SEGMENTET — vad bolaget gör och var det finns. Texten och
            kontorslistan i den breda spalten, kartan bredvid: Sverige är högt och
            smalt och passar en sidokolumn bättre än en liggande yta. */}
        <div className={`profile-body${harVerksamhet && pinnar.length ? "" : " single"}`}>
          <div>
            {c.desc && (
              <div className="panel">
                <h3>Om bolaget</h3>
                <Brodtext text={c.desc} />
              </div>
            )}
            {/* Bolagets egen formulering ur bolagsordningen. Formell, men sann och
                hämtad från bolaget självt — till skillnad från en text vi skrivit
                åt dem. Visas bara när ingen egen beskrivning finns. */}
            {!c.desc && c.verksamhetsbeskrivning && (
              <div className="panel">
                <h3>Verksamhet</h3>
                <Brodtext text={c.verksamhetsbeskrivning} />
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
            {/* Kartan är ritad ur postnummerregistret som redan ligger i
                projektet: en prick per bebodd ruta ger en igenkännbar silhuett,
                och kontoren sätts ut som nålar ovanpå. Ingen kartleverantör,
                inga rutor att hämta och inget skript i webbläsaren — det här är
                en orienteringsbild, inte ett verktyg att zooma i. */}
            {pinnar.length > 0 && (
              <div className="panel panel-karta">
                <h3>Var bolaget finns</h3>
                <Sverigekarta pinnar={pinnar} namn={c.name} />
                {/* Attribution krävs av licensen. Adressen till datamängden står
                    i POSTNUMMER_KALLA och i byggskriptet — här räcker namnet och
                    licensen, en utskriven URL blir tre rader bruten text. */}
                <div className="note">Orterna är utsatta efter postnummerregistret (GeoNames, CC BY 4.0).</div>
              </div>
            )}
          </div>
        </div>

        {/* TREDJE SEGMENTET — bolagets egna bilder, sist. Den som scrollat hit
            har läst färdigt och kan titta i lugn och ro, och den som bara ville
            ha fakta har fått dem utan att först bläddra förbi ett bildspel. */}
        {c.slideshow?.length > 0 && (
          <div className="panel panel-bilder">
            <Bildspel bilder={c.slideshow} namn={c.name} />
          </div>
        )}

      </div>
    </div>
  );
}
