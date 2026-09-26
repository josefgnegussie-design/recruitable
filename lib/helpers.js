import { REGION_MAP, YRKESOMRADEN } from "./taxonomy";

export function regionForCity(city) {
  for (const [region, cities] of Object.entries(REGION_MAP)) {
    if (cities.includes(city)) return region;
  }
  return "";
}

export function allRegionCities() {
  return [...new Set(Object.values(REGION_MAP).flat())].sort((a, b) => a.localeCompare(b, "sv"));
}

export function citiesForRegion(region) {
  return region ? REGION_MAP[region] : allRegionCities();
}

// Ortsnamnet så som det står i REGION_MAP, eller "" om orten inte finns där.
//
// Ett kontors ort måste stavas exakt som sökfiltrets, annars kan de två aldrig
// mötas: besökaren väljer "Göteborg" ur listan, medan kontoret sparats som
// "Gbg" eller "Göteborg " och därmed aldrig blir en träff — förfrågan går då
// tyst till bolagets generella adress trots att kontoret är betalt.
// Jämförelsen är tolerant (trimmad gemenform), det sparade värdet är alltid
// det kanoniska. REGION_MAP rymmer samtliga kommuner, så listan utesluter
// ingen ort i landet.
let ortsIndex = null;
export function kanoniskOrt(ort) {
  if (typeof ort !== "string") return "";
  const nyckel = ort.trim().toLowerCase();
  if (!nyckel) return "";
  if (!ortsIndex) ortsIndex = new Map(allRegionCities().map((o) => [o.toLowerCase(), o]));
  return ortsIndex.get(nyckel) ?? "";
}

export function rolesForArea(omrade) {
  const roles = omrade ? YRKESOMRADEN[omrade] : null;
  return roles && roles.length ? roles : Object.values(YRKESOMRADEN).flat();
}

export function empNum(c) {
  return parseInt(String(c.employees).replace(/[^0-9]/g, "")) || 0;
}

// Relevanspoäng: träff på yrkesområde väger tyngre än träff på ort.
export function partnersRelevance(c, omrade, ort) {
  let score = 0;
  if (omrade && c.focus.includes(omrade)) score += 2;
  if (ort && (c.city === ort || c.address.toLowerCase().includes(ort.toLowerCase()))) score += 1;
  return score;
}

export function flowMatches(omrade, ort, companies) {
  let list = companies;
  if (omrade) list = list.filter((c) => c.focus.includes(omrade));
  if (ort) list = list.filter((c) => c.city === ort || c.address.toLowerCase().includes(ort.toLowerCase()));
  return list;
}

// Samma ortsregel som i databasfrågan i lib/companiesRepo.js: bolaget finns på
// orten om huvudorten stämmer, om adressen nämner den, eller om någon av dess
// kontorsorter är den. Reservvägen får inte svara annorlunda än registret.
function finnsPaOrt(c, ort) {
  if (c.city === ort) return true;
  if (c.address?.toLowerCase().includes(ort.toLowerCase())) return true;
  return (c.officeCities ?? []).includes(ort);
}

// Filtrering för det riktiga förfrågningsflödet (Kvickfiltret på /rekrytera).
export function filterCompanies(companies, filters = {}) {
  const { omrade, service, ort } = filters;
  return companies.filter((c) => {
    if (omrade && !c.focus.includes(omrade)) return false;
    if (service && !c.services.includes(service)) return false;
    if (ort && !finnsPaOrt(c, ort)) return false;
    return true;
  });
}

// Haversine-formeln — avstånd i kilometer mellan två lat/lng-punkter (fågelvägen).
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
