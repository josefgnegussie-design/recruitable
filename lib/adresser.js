// Adressreglerna, samlade på ett ställe av samma skäl som mapInquiryRow i
// lib/inquiries.js: de används av API-routen som sparar och av härledningen av
// companies.office_cities, och två uppsättningar regler blir förr eller senare
// två olika svar på vad en giltig adress är.

export const MAX_ADRESSER = 25;

// Svenskt postnummer, med eller utan mellanslag. Frivilligt fält, så tomt är ok.
const POSTNUMMER_RE = /^\d{3}\s?\d{2}$/;

// En adress är giltig om den har en postort. Gatuadress och postnummer är
// frivilliga — ett bolag ska kunna säga att det finns på en ort utan att lämna
// ut adressen till ett kontorshotell.
export function giltigAdress(a) {
  if (typeof a !== "object" || a === null || Array.isArray(a)) return false;
  const { street = "", postal_code = "", city = "" } = a;
  if (typeof street !== "string" || street.length > 200) return false;
  if (typeof city !== "string" || !city.trim() || city.length > 100) return false;
  if (typeof postal_code !== "string" || postal_code.length > 10) return false;
  if (postal_code.trim() && !POSTNUMMER_RE.test(postal_code.trim())) return false;
  return true;
}

export function giltigaAdresser(v) {
  return Array.isArray(v) && v.length <= MAX_ADRESSER && v.every(giltigAdress);
}

// Postnumret sparas i ett format: "413 27", aldrig "41327". Blandade format i
// registret ser slarvigt ut när adresserna listas under varandra på profilen.
export function normaliseraAdress(a) {
  const siffror = (a.postal_code || "").replace(/\s/g, "");
  return {
    street: (a.street || "").trim(),
    postal_code: siffror ? `${siffror.slice(0, 3)} ${siffror.slice(3)}` : "",
    city: a.city.trim(),
  };
}

// companies.office_cities härleds ur adresserna i stället för att fyllas i
// separat. Det är den kolumn sökkorten och profilens Snabbfakta läser, och två
// fält för samma uppgift skulle förr eller senare säga emot varandra.
// Dubbletter faller bort och ordningen behålls — bolaget har lagt adresserna i
// den ordning de vill bli lästa.
export function orterUrAdresser(adresser) {
  return [...new Set(adresser.map((a) => a.city))];
}
