import { hamtaUrval, raknaBolag } from "@/lib/companiesRepo";
import RekryteraSok from "@/components/RekryteraSok";

export const metadata = {
  title: "Hitta bemannings- och rekryteringsbolag",
  description:
    "Sök bland Sveriges bemannings- och rekryteringsbolag efter ort, yrkesområde och tjänst, och skicka en förfrågan till dem som passar.",
  alternates: { canonical: "/rekrytera" },
};

export const revalidate = 300;

// Sidan hämtar sitt underlag på servern i stället för att importera hela
// registret i klientkoden. Med ett par tusen bolag skulle den gamla lösningen
// betyda närmare två megabyte JavaScript hos varje besökare innan första
// sökningen — här skickas bara det som faktiskt visas.
export default async function PartnersPage() {
  const [antalBolag, urval] = await Promise.all([raknaBolag(), hamtaUrval(6)]);

  return <RekryteraSok antalBolag={antalBolag} urval={urval} />;
}
