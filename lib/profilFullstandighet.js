// Hur komplett ett bolags profil är, räknat på de fält bolaget själv fyller i
// under Profil på Mina sidor (ProfilEditor). Visas i översikten överst på
// förfrågningsfliken.
//
// Bara det som rimligen gäller alla bolag räknas. ISO-certifieringar och
// kollektivavtal saknas hos många av goda skäl, och ska inte se ut som en
// brist. Läggs ett fält till i ProfilEditor som alla bör fylla i hör det
// hemma här också.
export const PROFILFALT = [
  { namn: "Logotyp", ifyllt: (c) => Boolean(c.logo) },
  { namn: "Vision", ifyllt: (c) => Boolean(c.vision?.trim()) },
  { namn: "Beskrivning", ifyllt: (c) => Boolean(c.description?.trim()) },
  { namn: "Tjänster", ifyllt: (c) => c.services?.length > 0 },
  { namn: "Yrkesområden", ifyllt: (c) => c.focus?.length > 0 },
  { namn: "Yrkesroller", ifyllt: (c) => c.recruiting_roles?.length > 0 },
  { namn: "Webbplats", ifyllt: (c) => Boolean(c.link?.trim()) },
  { namn: "Kontaktadress", ifyllt: (c) => Boolean(c.contact?.trim()) },
  { namn: "Adresser", ifyllt: (c) => c.addresses?.length > 0 },
  { namn: "Bildspel", ifyllt: (c) => c.slideshow?.length > 0 },
  {
    namn: "Nyckeltal",
    ifyllt: (c) => Boolean(c.company_key_figures?.employees || c.company_key_figures?.revenue),
  },
  {
    namn: "Nöjdhetsmätning",
    ifyllt: (c) =>
      c.surveys?.customer_satisfaction?.score != null || c.surveys?.employee_satisfaction?.score != null,
  },
];

// Kolumnerna PROFILFALT läser, för select() mot companies.
export const PROFILFALT_KOLUMNER =
  "logo, vision, description, services, focus, recruiting_roles, link, contact, addresses, slideshow, " +
  "company_key_figures, surveys";

export function profilFullstandighet(company) {
  if (!company) return null;
  const saknas = PROFILFALT.filter((f) => !f.ifyllt(company)).map((f) => f.namn);
  return { ifyllda: PROFILFALT.length - saknas.length, totalt: PROFILFALT.length, saknas };
}
