import InquiryWizard from "@/components/inquiry/InquiryWizard";
import { hamtaBolag } from "@/lib/companiesRepo";
import { publikaBolag } from "@/lib/publikBolag";

export const dynamic = "force-dynamic";

// Träfflistan tas fram på servern. Tidigare importerades hela registret i
// klientkoden och filtrerades i webbläsaren, vilket inte bär vid ett par tusen
// bolag. Taket på 100 finns för att guiden listar varje träff som ett kort med
// kryssruta — fler än så är ingen användbar valsituation, och breda sökningar
// bör snävas in i filtret i stället.
const MAX_TRAFFAR = 100;

export default async function PartnersResultPage({ searchParams }) {
  const params = await searchParams;

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
