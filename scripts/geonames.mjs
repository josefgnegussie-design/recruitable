// Hämtar GeoNames postnummerfil för Sverige (CC BY 4.0).
//
// Bröts ut ur bygg-koordinater.mjs när bygg-postnummer.mjs behövde samma sak.
// Zip-läsaren är tillräckligt kinkig — central katalog, databeskrivare, offset
// till lokalt filhuvud — för att två kopior av den vore en dålig idé.

const GEONAMES = "https://download.geonames.org/export/zip/SE.zip";

// Zip-filen packas upp utan beroenden: posterna ligger deflate-komprimerade och
// node:zlib klarar dem direkt.
export async function hamtaGeonames() {
  const { inflateRawSync } = await import("node:zlib");
  const svar = await fetch(GEONAMES);
  if (!svar.ok) throw new Error(`Kunde inte hämta GeoNames (${svar.status})`);
  const zip = Buffer.from(await svar.arrayBuffer());

  // Arkivet innehåller både readme.txt och SE.txt, så posterna i den centrala
  // katalogen (signatur PK\x01\x02) gås igenom tills rätt namn dyker upp.
  // Storleken läses därifrån och inte ur det lokala filhuvudet, som står som
  // noll när arkivet har en databeskrivare.
  const SIGNATUR = Buffer.from([0x50, 0x4b, 0x01, 0x02]);

  for (let post = zip.indexOf(SIGNATUR); post >= 0; post = zip.indexOf(SIGNATUR, post + 4)) {
    const namnLangd = zip.readUInt16LE(post + 28);
    const namn = zip.subarray(post + 46, post + 46 + namnLangd).toString("utf-8");
    if (namn.toUpperCase() !== "SE.TXT") continue;

    const komprimerad = zip.readUInt32LE(post + 20);
    const lokaltHuvud = zip.readUInt32LE(post + 42);
    const dataStart =
      lokaltHuvud + 30 + zip.readUInt16LE(lokaltHuvud + 26) + zip.readUInt16LE(lokaltHuvud + 28);

    return inflateRawSync(zip.subarray(dataStart, dataStart + komprimerad)).toString("utf-8");
  }

  throw new Error("Hittade ingen SE.txt i arkivet");
}

// Kolumnerna i SE.txt, tabbseparerade. Se readme.txt i arkivet.
//   0 land  1 postnummer  2 postort  3 län  5 kommun  9 lat  10 lng
export function radTillPost(rad) {
  const f = rad.split("\t");
  const postnummer = (f[1] || "").replace(/\s/g, "");
  const postort = (f[2] || "").trim();
  if (!/^\d{5}$/.test(postnummer) || !postort) return null;

  const lat = parseFloat(f[9]);
  const lng = parseFloat(f[10]);

  return {
    postnummer,
    postort,
    lan: (f[3] || "").trim() || null,
    kommun: (f[5] || "").trim() || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}
