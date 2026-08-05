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

// Filtrering för det riktiga förfrågningsflödet (Kvickfiltret på /partners).
export function filterCompanies(companies, filters = {}) {
  const { omrade, service, ort } = filters;
  return companies.filter((c) => {
    if (omrade && !c.focus.includes(omrade)) return false;
    if (service && !c.services.includes(service)) return false;
    if (ort && !(c.city === ort || c.address.toLowerCase().includes(ort.toLowerCase()))) return false;
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
