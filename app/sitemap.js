import { hamtaBolag } from "@/lib/companiesRepo";
import { bolagsUrl } from "@/lib/slug";

const SITE = "https://recruitable.se";

// Sidorna som finns oavsett register. /bolag är utelämnad — den vidarebefordrar
// till /rekrytera — liksom inloggning, konto och allt bakom den.
const SIDOR = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/rekrytera", changeFrequency: "weekly", priority: 0.9 },
  { path: "/matcha", changeFrequency: "monthly", priority: 0.7 },
  { path: "/for-bolag/registrera", changeFrequency: "monthly", priority: 0.6 },
  { path: "/om-oss", changeFrequency: "yearly", priority: 0.5 },
  { path: "/kontakt", changeFrequency: "yearly", priority: 0.5 },
  { path: "/integritetspolicy", changeFrequency: "yearly", priority: 0.2 },
];

// Registret rymmer tusentals bolag hämtade ur offentliga källor, men bara de vi
// arbetat igenom har en beskrivning. Att skicka sökmotorer till de övriga vore
// att peka dem på tomma kort. Samma krav som används där bolag ställs ut som
// exempel — vill du ha med hela registret, ta bort endastKompletta nedan.
const SIDSTORLEK = 100;
const TAK = 5000;

async function bolagssidor() {
  const adresser = [];

  for (let sida = 1; adresser.length < TAK; sida++) {
    const { bolag, totalt } = await hamtaBolag({
      sida,
      antal: SIDSTORLEK,
      endastKompletta: true,
    });

    if (!bolag?.length) break;
    for (const c of bolag) adresser.push({ url: `${SITE}${bolagsUrl(c)}`, changeFrequency: "monthly", priority: 0.6 });
    if (adresser.length >= totalt) break;
  }

  return adresser;
}

// Byggs om en gång i timmen i stället för vid varje hämtning: listan ändras när
// en profil fylls i, inte per minut, och en genomgång av registret är dyrare än
// en vanlig sidvisning. Priset är att växlingen nedan kan släpa en timme efter
// att underhållsläget slås på eller av — robots.txt är den omedelbara grinden,
// den byggs per hämtning.
export const revalidate = 3600;

export default async function sitemap() {
  const statiska = SIDOR.map(({ path, ...rest }) => ({ url: `${SITE}${path}`, ...rest }));

  // Under underhållsläge svarar varje adress med underhållssidan. En karta över
  // dem vore en karta över samma sida om och om igen.
  if (process.env.MAINTENANCE_MODE === "1") return [];

  try {
    return [...statiska, ...(await bolagssidor())];
  } catch (err) {
    // Hellre en karta över de fasta sidorna än ingen karta alls.
    console.error("Kunde inte läsa registret till sitemap:", err.message);
    return statiska;
  }
}
