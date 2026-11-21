// Arbetsställen i en upphandling: där konsulterna ska arbeta. ENDAST SERVERSIDAN —
// koordinaterna slås upp i postnummerregistret, som är en halv megabyte.
//
// Köparen anger gatuadress och postnummer för varje arbetsställe. Postnumret ger
// en exakt punkt att räkna avstånd från, och avståndet är det som avgör om ett
// bolag kan leverera: kollektivavtalets resevillkor räknas från arbetsstället,
// inte från kommunens mitt. Gatuadressen följer med i inbjudan men visas för
// bolaget först vid accept (lib/inquiries.js), eftersom en adress ofta pekar ut
// köparen lika tydligt som namnet.

import { allRegionCities, distanceKm, kanoniskOrt } from "@/lib/helpers";
import { koordinatForOrt, slaUppPostnummer } from "@/lib/postnummer";

export const MAX_ADRESS = 80;

let kommunpunkter = null;

// Kommunen för ett postnummer: postorten om den är en kommun i listan, annars
// den närmaste. "Hisings Backa" blir Göteborg, "Västra Frölunda" likaså. Det är
// kommunen som styr routningen till betalda kontor och regionen i förfrågan.
function narmasteKommun(postort, lat, lng) {
  const direkt = kanoniskOrt(postort);
  if (direkt) return direkt;
  if (!kommunpunkter) {
    kommunpunkter = allRegionCities()
      .map((ort) => ({ ort, k: koordinatForOrt(ort) }))
      .filter((p) => p.k);
  }
  let bast = null;
  for (const p of kommunpunkter) {
    const km = distanceKm(lat, lng, p.k.lat, p.k.lng);
    if (!bast || km < bast.km) bast = { ort: p.ort, km };
  }
  return bast?.ort ?? "";
}

// Ett arbetsställe som köparen skrivit in, kontrollerat. Null om postnumret inte
// finns eller adressen är orimlig.
export function arbetsstalleFran(raw) {
  if (!raw || typeof raw !== "object") return null;
  const adress = typeof raw.adress === "string" ? raw.adress.trim() : "";
  if (adress.length > MAX_ADRESS) return null;
  const post = slaUppPostnummer(raw.postnummer);
  if (!post) return null;
  return {
    adress,
    postnummer: post.postnummer,
    postort: post.postort,
    kommun: narmasteKommun(post.postort, post.lat, post.lng),
    lat: post.lat,
    lng: post.lng,
  };
}

// Det köparen ser som etikett på arbetsstället i matchningen.
export function arbetsstalleEtikett(a) {
  return a.adress ? `${a.adress}, ${a.postort}` : `${a.postnummer} ${a.postort}`;
}

// Det som sparas i inquiries.upphandling. Koordinaterna behövs inte efteråt.
export function arbetsstalleAttSpara({ adress, postnummer, postort, kommun }) {
  return { adress, postnummer, postort, kommun };
}
