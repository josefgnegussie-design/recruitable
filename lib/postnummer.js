// Uppslag i postnummerregistret. ENDAST SERVERSIDAN — datafilen är en halv
// megabyte och har inget i webbläsaren att göra. Importeras bara av
// app/api/postnummer/sok.
//
// Datan kommer ur GeoNames (CC BY 4.0) och byggs av scripts/bygg-postnummer.mjs.

import data from "@/lib/data/postnummer.json";

export const POSTNUMMER_KALLA = data.kalla;

// Indexen byggs en gång per serverinstans. Nitton tusen poster är för lite för
// att motivera en databas, men för mycket för att söka linjärt i vid varje
// tangenttryck när sökningen går på exakt postnummer.
const perPostnummer = new Map();
for (const [postnummer, ortIndex, lat, lng] of data.poster) {
  if (!perPostnummer.has(postnummer)) {
    perPostnummer.set(postnummer, { postnummer, postort: data.orter[ortIndex], lat, lng });
  }
}

// Postorterna med gemener för prefixsökning, i samma ordning som data.orter.
const orterLower = data.orter.map((o) => o.toLowerCase());

// Hur många postnummer varje ort har. Används för att rangordna förslagen:
// utan det hamnade Stockholm utanför listan för "sto", eftersom Stoby,
// Stocka, Stockamöllan och Stockaryd kommer före alfabetiskt. Antalet
// postnummer är den bästa storleksuppskattning datan innehåller — Stockholm
// har hundratals, Stoby ett par.
const ortAntal = new Array(data.orter.length).fill(0);
for (const [, ortIndex] of data.poster) ortAntal[ortIndex]++;

function formatera(postnummer) {
  return `${postnummer.slice(0, 3)} ${postnummer.slice(3)}`;
}

function tillSvar(post) {
  return {
    postnummer: formatera(post.postnummer),
    postort: post.postort,
    lat: post.lat,
    lng: post.lng,
  };
}

// Exakt träff på ett fullständigt postnummer. Används för att fylla i postorten
// direkt när bolaget skrivit klart, utan att något behöver väljas ur listan.
export function slaUppPostnummer(varde) {
  const siffror = String(varde || "").replace(/\D/g, "");
  if (siffror.length !== 5) return null;
  const post = perPostnummer.get(siffror);
  return post ? tillSvar(post) : null;
}

// Förslag medan man skriver. Siffror tolkas som postnummer, bokstäver som
// postort — ett fält kan alltså inte förväxlas med det andra.
export function sokPostnummer(fraga, max = 8) {
  const q = String(fraga || "").trim();
  if (!q) return [];

  const siffror = q.replace(/\D/g, "");

  // Postnummer: prefixsökning. Under tre siffror blir listan meningslös —
  // varje prefix matchar hundratals postnummer.
  if (siffror.length >= 3 && !/[a-zåäö]/i.test(q)) {
    const traffar = [];
    for (const post of perPostnummer.values()) {
      if (!post.postnummer.startsWith(siffror)) continue;
      traffar.push(tillSvar(post));
      if (traffar.length >= max) break;
    }
    return traffar;
  }

  // Postort: de som börjar med söksträngen först, därefter de som innehåller
  // den. "lund" ska ge Lund före Lundsbrunn, men Lundsbrunn ska finnas med.
  const nal = q.toLowerCase();
  if (nal.length < 2) return [];

  const borjar = [];
  const innehaller = [];
  for (let i = 0; i < orterLower.length; i++) {
    const ort = orterLower[i];
    if (ort.startsWith(nal)) borjar.push(i);
    else if (ort.includes(nal)) innehaller.push(i);
  }

  // Störst först inom varje grupp, men en ort som börjar med söksträngen slår
  // alltid en som bara innehåller den.
  const storst = (a, b) => ortAntal[b] - ortAntal[a];
  borjar.sort(storst);
  innehaller.sort(storst);

  return [...borjar, ...innehaller].slice(0, max).map((i) => ({ postort: data.orter[i] }));
}
