import { hamtaUrval, raknaBolag } from "@/lib/companiesRepo";
import { hamtaPagaendeForfragningar } from "@/lib/pagaendeForfragningar";
import RekryteraSok from "@/components/RekryteraSok";
import PagaendeLista, { pagaendeIntro } from "@/components/PagaendeLista";

export const revalidate = 300;

// Sidan hämtar sitt underlag på servern i stället för att importera hela
// registret i klientkoden. Med ett par tusen bolag skulle den gamla lösningen
// betyda närmare två megabyte JavaScript hos varje besökare innan första
// sökningen — här skickas bara det som faktiskt visas.
export default async function PartnersPage() {
  const [antalBolag, urval, pagaende] = await Promise.all([
    raknaBolag(),
    hamtaUrval(6),
    hamtaPagaendeForfragningar(),
  ]);

  return (
    <>
      <RekryteraSok antalBolag={antalBolag} urval={urval} />
      {/* Bara vanliga förfrågningar; upphandlingar visas på /upphandling. Se
          lib/pagaendeForfragningar.js för vad som får visas. */}
      <section className="l-section tight">
        <PagaendeLista
          id="rek-pagaende-rubrik"
          rubrik="Pågående förfrågningar"
          intro={pagaendeIntro(pagaende, {
            riktiga: "Ett urval av förfrågningar som skickats via Recruitable. Beställarna visas inte.",
            exempel: "Så här visas förfrågningar som skickats via Recruitable, utan beställarens namn.",
          })}
          kort={pagaende}
          stegEtikett="Förfrågans steg"
        />
      </section>
    </>
  );
}
