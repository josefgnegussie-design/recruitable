import { REGION_MAP, YRKESOMRADEN, AREA_TO_BRANSCH } from "./taxonomy";

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

// Relevanspoäng: träff på yrkesområdets bransch-taggar väger tyngre än träff på ort.
export function partnersRelevance(c, omrade, ort) {
  let score = 0;
  if (omrade) {
    const branschTags = AREA_TO_BRANSCH[omrade] || [];
    if (c.focus.some((f) => branschTags.includes(f))) score += 2;
  }
  if (ort && (c.city === ort || c.address.toLowerCase().includes(ort.toLowerCase()))) score += 1;
  return score;
}

export function flowMatches(omrade, ort, companies) {
  let list = companies;
  if (omrade) {
    const branschTags = AREA_TO_BRANSCH[omrade] || [];
    if (branschTags.length) list = list.filter((c) => c.focus.some((f) => branschTags.includes(f)));
  }
  if (ort) list = list.filter((c) => c.city === ort || c.address.toLowerCase().includes(ort.toLowerCase()));
  return list;
}

// Vi saknar riktiga logotypfiler för de flesta bolag — visar därför ett genererat monogram i stället för en faktisk logga.
const LOGO_COLORS = ["var(--navy-700)", "var(--rust-500)", "var(--stone-600)", "var(--navy-600)", "var(--rust-600)", "var(--navy-800)"];

export function logoInitials(name) {
  const words = name.replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter((w) => /[A-Za-zÅÄÖåäö]/.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || name[0].toUpperCase();
}

export function logoColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return LOGO_COLORS[hash % LOGO_COLORS.length];
}
