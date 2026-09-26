// ISO-certifieringarna ett bolag kan ange på sin profil. Koden är det som
// sparas i companies.iso_certifications; namnet är det besökaren läser.
//
// Listan är medvetet kort: det är de två certifieringar kunder faktiskt frågar
// efter vid upphandling av bemanning. Fler läggs till här och ingen annanstans —
// formuläret, API-valideringen och profilsidan läser alla samma lista.
export const ISO_CERTIFIERINGAR = [
  { kod: "ISO 9001", namn: "Kvalitetsledning" },
  { kod: "ISO 14001", namn: "Hållbart miljöarbete" },
];

export const GILTIGA_ISO = new Set(ISO_CERTIFIERINGAR.map((c) => c.kod));

// Bolagets certifieringar i listans ordning, oavsett i vilken ordning de
// kryssats i, och utan okända värden. Den statiska reservfilen lib/companies.js
// har ett gammalt `iso: false` per bolag, så allt som inte är en lista räknas
// som ingen certifiering.
export function sorteradeIso(koder) {
  const valda = new Set(Array.isArray(koder) ? koder : []);
  return ISO_CERTIFIERINGAR.filter((c) => valda.has(c.kod));
}
