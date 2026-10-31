import InquiryWizard from "@/components/inquiry/InquiryWizard";
import { hamtaBolag, hamtaBolagMedId, hamtaBolagMedSlug } from "@/lib/companiesRepo";
import { publikaBolag } from "@/lib/publikBolag";
import { arId } from "@/lib/slug";

export const metadata = {
  title: "Välj bolag",
  description: "Välj vilka bemannings- och rekryteringsbolag ni vill skicka er förfrågan till.",
};

export const dynamic = "force-dynamic";

// Träfflistan tas fram på servern. Tidigare importerades hela registret i
// klientkoden och filtrerades i webbläsaren, vilket inte bär vid ett par tusen
// bolag. Taket på 100 finns för att guiden listar varje träff som ett kort med
// kryssruta — fler än så är ingen användbar valsituation, och breda sökningar
// bör snävas in i filtret i stället.
const MAX_TRAFFAR = 100;

// ?bolag= kommer från knappen på en profilsida: besökaren har redan valt sitt
// bolag och ska inte möta en träfflista. Ett upphört eller okänt bolag ger
// vanlig sökning i stället — profilen visar ingen knapp för dem, så hit kommer
// man bara med en gammal eller handskriven länk.
async function forvaltBolag(nyckel) {
  if (typeof nyckel !== "string" || !nyckel) return null;
  const bolag = arId(nyckel) ? await hamtaBolagMedId(nyckel) : await hamtaBolagMedSlug(nyckel);
  return bolag && !bolag.retiredAt ? bolag : null;
}

export default async function PartnersResultPage({ searchParams }) {
  const params = await searchParams;

  const forvalt = await forvaltBolag(params.bolag);
  if (forvalt) {
    return (
      <InquiryWizard
        filters={{ beskrivning: "", omrade: "", service: "", ort: "", bolag: forvalt.slug || String(forvalt.id) }}
        results={publikaBolag([forvalt])}
        totalt={1}
      />
    );
  }

  const filters = {
    beskrivning: params.beskrivning || "",
    omrade: params.omrade || "",
    service: params.tjanst || "",
    ort: params.ort || "",
  };

  const { bolag, totalt } = await hamtaBolag({
    omrade: filters.omrade,
    tjanst: filters.service,
    ort: filters.ort,
    antal: MAX_TRAFFAR,
  });

  // Korten hamnar i en klientkomponent, alltså i sidans egen källkod.
  return <InquiryWizard filters={filters} results={publikaBolag(bolag)} totalt={totalt} />;
}
