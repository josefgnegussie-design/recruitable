// Gatuadress till koordinater via OpenStreetMaps Nominatim. ENDAST SERVERSIDAN:
// tjänsten får bara adressen, aldrig besökarens IP-adress.
//
// Används av kartan "Bolag nära er" (besökarens adresser) och när ett bolag
// sparar sina adresser på Mina sidor, så att varje kontor får en egen punkt.
// Nominatim tillåter ungefär ett anrop i sekunden, så svaren sparas och
// anroparen slår upp en adress i taget.

import { distanceKm } from "@/lib/helpers";

export const GATA = /[a-zåäöé]{3,}\.?\s+\d+/i;
const cache = new Map();

// { lat, lng } eller null. `grov` är en känd punkt för postorten: en träff mer
// än 40 km därifrån är en annan gata med samma namn och räknas inte.
export async function geokodaGata(text, grov = null) {
  const q = String(text || "").trim().slice(0, 200);
  if (!q || !GATA.test(q)) return null;
  const nyckel = q.toLowerCase();
  if (cache.has(nyckel)) return cache.get(nyckel);

  let svar = null;
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=se&q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: { "User-Agent": "Recruitable (https://recruitable.se)", "Accept-Language": "sv" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const [forsta] = await res.json();
      const lat = Number(forsta?.lat);
      const lng = Number(forsta?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (!grov || distanceKm(lat, lng, grov.lat, grov.lng) < 40)) {
        svar = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
      }
    }
  } catch (err) {
    console.error("Kunde inte slå upp gatuadressen:", err.message);
    return null; // Ett nätfel sparas inte, så att nästa försök får en ny chans.
  }
  if (cache.size > 2000) cache.clear();
  cache.set(nyckel, svar);
  return svar;
}
