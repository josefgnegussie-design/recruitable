import RegisterForm from "@/components/admin/RegisterForm";
import { hamtaBolagMedSlug } from "@/lib/companiesRepo";

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
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">För bemannings- och rekryteringsföretag</div>
          <h1 className="hero-title">{inbjudet ? `Ta över ${inbjudet.name}` : "Registrera företag"}</h1>
          <p className="hero-sub">
            {inbjudet
              ? "Bolagsuppgifterna är ifyllda åt er. Det som återstår är ett konto med en mejladress på bolagets egen domän — den måste matcha webbplatsen, det är så vi vet att det är ni."
              : "Skapa ett konto för att utöka er profil med mer information om er verksamhet. Kräver att din e-postadress matchar bolagets registrerade webbplats."}
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <RegisterForm forifyllt={forifyllt} />
      </div>
    </div>
  );
}
