import RegisterForm from "@/components/admin/RegisterForm";
import { hamtaBolagMedSlug } from "@/lib/companiesRepo";

export const metadata = {
  title: "Registrera ert bolag",
  description:
    "Skapa ett konto för ert bemannings- eller rekryteringsbolag, komplettera profilen och ta emot förfrågningar.",
  alternates: { canonical: "/for-bolag/registrera" },
};

export const dynamic = "force-dynamic";

// ?bolag=<slug> kommer från inbjudningssidan /valkommen/[slug]. Uppgifterna
// fylls i åt bolaget, och — viktigare — organisationsnumret följer med. Det är
// det granskningskön matchar på, så en inbjuden ansökan kopplas automatiskt
// till rätt rad i registret i stället för att granskaren får söka fram den.
export default async function RegistreraPage({ searchParams }) {
  const params = await searchParams;
  const slug = typeof params?.bolag === "string" ? params.bolag : null;
  const bolag = slug ? await hamtaBolagMedSlug(slug) : null;

  // Ett redan övertaget eller upphört bolag förifylls inte: den vägen leder
  // bara till en ansökan som blir avslagen.
  const inbjudet = bolag && !bolag.claimed && !bolag.retiredAt ? bolag : null;

  const forifyllt = inbjudet
    ? {
        companyName: inbjudet.name,
        orgNumber: inbjudet.orgNumber || "",
        website: inbjudet.link || "",
      }
    : null;

  return (
    <div id="view-registrera">
      {/* Rubriken och formuläret delar vänsterkant. Förut var rubriken
          vänsterställd i en 640-spalt och formuläret centrerat i en smalare,
          så de två blocken stod förskjutna mot varandra. */}
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto", paddingBottom: 28 }}>
        <div>
          <div className="eyebrow">För bemannings- och rekryteringsbolag</div>
          <h1 className="hero-title">{inbjudet ? `Ta över ${inbjudet.name}` : "Registrera ert bolag"}</h1>
          <p className="hero-sub">
            {inbjudet
              ? "Bolagsuppgifterna är ifyllda åt er. Det som återstår är ett konto med en mejladress på bolagets egen domän. Den måste matcha webbplatsen, det är så vi vet att det är ni."
              : "Skapa ett konto för att komplettera er profil med mer information om verksamheten. Din mejladress behöver ha samma domän som bolagets registrerade webbplats."}
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 480 }}>
          <RegisterForm forifyllt={forifyllt} />
        </div>
      </div>
    </div>
  );
}
