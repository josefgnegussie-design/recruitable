// Serversidans företagsuppslag: används av /api/foretag/sok och /api/foretag/uppslag
// för att autofylla org.nummer, adress m.m. när en bolagsadmin registrerar sig.
//
// Två källor, med olika roller:
//
//   1. allabolag.se — fritextsökning på företagsnamn. Sidan bransch-sök bäddar in
//      hela träfflistan som JSON i sidkällan (Next.js __NEXT_DATA__), samma teknik
//      som scripts/fetch-allabolag-sni.mjs redan använder. allabolag har inget
//      gratis öppet API (deras "API" är UC:s kommersiella CRM-produkt), så det här
//      är en publik sida vi läser — den kan ändra form utan förvarning och får
//      därför aldrig vara ett krav för att kunna registrera sig.
//
//   2. Bolagsverkets API för värdefulla datamängder — officiell källa, gratis,
//      slår upp ETT organisationsnummer i taget. Ger registrerat namn, säte,
//      bolagsform, SNI och om bolaget är aktivt. Nycklarna (BOLAGSVERKET_CLIENT_ID
//      /_SECRET) ligger redan i miljön för scripts/enrich-bolagsverket.mjs.
//
// Namnsökningen går alltså mot allabolag, medan uppgifterna som fylls i formuläret
// bekräftas mot Bolagsverket när org.numret väl är känt.

import { randomUUID } from "node:crypto";

const ALLABOLAG_SEARCH = "https://www.allabolag.se/bransch-sök";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const BOLAGSVERKET_BASE_URL =
  process.env.BOLAGSVERKET_BASE_URL || "https://gw.api.bolagsverket.se/vardefulla-datamangder/v1";
const BOLAGSVERKET_TOKEN_URL =
  process.env.BOLAGSVERKET_TOKEN_URL ||
  (BOLAGSVERKET_BASE_URL.includes("accept2")
    ? "https://portal-accept2.api.bolagsverket.se/oauth2/token"
    : "https://portal.api.bolagsverket.se/oauth2/token");
const BOLAGSVERKET_SCOPE = "vardefulla-datamangder:read";

const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Enkel TTL-cache i minnet. Håller nere trycket mot båda källorna när samma bolag
// slås upp flera gånger under en registrering (varje serverinstans har sin egen —
// det räcker gott för ett formulär och kräver ingen extra infrastruktur).
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map behåller insättningsordning — släng den äldsta posten.
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

// "556242-1718", "16556242-1718" och "5562421718" ger alla "5562421718".
export function normalizeOrgnr(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("16")) return digits.slice(2);
  return digits;
}

export function isOrgnr(raw) {
  return normalizeOrgnr(raw).length === 10;
}

export function formatOrgnr(raw) {
  const digits = normalizeOrgnr(raw);
  if (digits.length !== 10) return String(raw || "").trim();
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function formatPostnummer(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 5) return String(raw || "").trim();
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function titleCaseOrt(raw) {
  // Bolagsverket svarar med versaler ("GÖTEBORG") — snyggare i ett formulärfält
  // som "Göteborg". Rör inte namn som redan har gemener.
  const value = String(raw || "").trim();
  if (!value || value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/(^|[\s\-/])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

// Slår ihop gatuadress, postnummer och ort till den enda adressrad formuläret har.
export function composeAddress({ gatuadress, postnummer, postort }) {
  const street = String(gatuadress || "").trim();
  const zip = formatPostnummer(postnummer);
  const city = titleCaseOrt(postort);
  const tail = [zip, city].filter(Boolean).join(" ");
  return [street, tail].filter(Boolean).join(", ");
}

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

/* ---------------------------------------------------------------- allabolag */

function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function toCandidate(company) {
  if (!company || !company.orgnr) return null;
  const address = company.visitorAddress?.addressLine ? company.visitorAddress : company.postalAddress;
  return {
    namn: company.name || company.legalName || "",
    orgnr: formatOrgnr(company.orgnr),
    gatuadress: address?.addressLine || "",
    postnummer: formatPostnummer(address?.zipCode || ""),
    postort: titleCaseOrt(address?.postPlace || ""),
    kommun: company.location?.municipality || "",
    lan: company.location?.county || "",
    anstallda: company.employees || "",
  };
}

// Fritextsökning hos allabolag. Returnerar [] (kastar aldrig) om sidan är nere
// eller har bytt form — formuläret ska alltid gå att fylla i för hand.
export async function sokForetag(query, limit = 8) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const cacheKey = `sok:${q.toLowerCase()}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const candidates = [];
  try {
    const res = await fetchWithTimeout(`${ALLABOLAG_SEARCH}?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = parseNextData(await res.text());
    const store = data?.props?.pageProps?.hydrationData?.searchStore;
    // companiesByName är namnträffarna; companies är branschsökningen, som för ett
    // bolagsnamn ofta ger orelaterade träffar (den matchar även på ort). Namnlistan
    // först, branschlistan bara som utfyllnad.
    const raw = [...(store?.companiesByName?.companies || []), ...(store?.companies?.companies || [])];

    const seen = new Set();
    for (const company of raw) {
      const candidate = toCandidate(company);
      if (!candidate || seen.has(candidate.orgnr)) continue;
      seen.add(candidate.orgnr);
      candidates.push(candidate);
      if (candidates.length >= limit) break;
    }
  } catch (err) {
    console.error("Företagssökning mot allabolag misslyckades:", err.message);
    return [];
  }

  cacheSet(cacheKey, candidates);
  return candidates;
}

/* ------------------------------------------------------------ bolagsverket */

let tokenCache = null;

async function getBolagsverketToken() {
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID;
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchWithTimeout(BOLAGSVERKET_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: BOLAGSVERKET_SCOPE }),
  });

  if (!res.ok) throw new Error(`Token-hämtning misslyckades (${res.status})`);

  const json = await res.json();
  if (!json.access_token) throw new Error("Inget access_token i svaret");

  // Förnya en minut innan utgång så en pågående begäran aldrig hinner bli 401.
  const ttlMs = Math.max(30, Number(json.expires_in || 600) - 60) * 1000;
  tokenCache = { token: json.access_token, expires: Date.now() + ttlMs };
  return tokenCache.token;
}

function pickNamn(org) {
  const list = org.organisationsnamn?.organisationsnamnLista || [];
  const foretagsnamn = list.find((n) => n.organisationsnamntyp?.kod === "FORETAGSNAMN");
  return (foretagsnamn || list[0])?.namn || "";
}

async function hamtaFranBolagsverket(orgnr) {
  const token = await getBolagsverketToken();
  if (!token) return null;

  const res = await fetchWithTimeout(`${BOLAGSVERKET_BASE_URL}/organisationer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
    },
    body: JSON.stringify({ identitetsbeteckning: orgnr }),
  });

  if (!res.ok) throw new Error(`Uppslag misslyckades (${res.status})`);

  const org = (await res.json()).organisationer?.[0];
  if (!org) return null;

  const postadress = org.postadressOrganisation?.fel ? null : org.postadressOrganisation?.postadress;
  const sni = (org.naringsgrenOrganisation?.sni || []).filter((s) => s?.kod?.trim() && !s.fel);

  return {
    namn: pickNamn(org),
    bolagsform: org.organisationsform?.fel ? "" : org.organisationsform?.klartext || "",
    registreringsdatum: org.organisationsdatum?.fel ? "" : org.organisationsdatum?.registreringsdatum || "",
    aktiv: org.verksamOrganisation?.fel ? null : org.verksamOrganisation?.kod === "JA",
    avregistrerad: Boolean(org.avregistreradOrganisation?.avregistreringsdatum),
    sni: sni.map((s) => ({ kod: s.kod.trim(), klartext: s.klartext })),
    gatuadress: postadress?.utdelningsadress || "",
    postnummer: postadress?.postnummer || "",
    postort: postadress?.postort || "",
  };
}

/* ------------------------------------------------------------------ uppslag */

// Slår upp ett organisationsnummer och returnerar de fält registreringsformuläret
// fyller i. Bolagsverket är facit för namn och säte; allabolag bidrar med
// besöksadress och antal anställda, och får täcka upp helt om Bolagsverket inte
// svarar. Kastar aldrig — { hittad: false } betyder "fyll i för hand".
export async function slaUppOrgnr(rawOrgnr) {
  const orgnr = normalizeOrgnr(rawOrgnr);
  if (orgnr.length !== 10) return { hittad: false, fel: "ogiltigt-orgnr" };

  const cacheKey = `orgnr:${orgnr}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const [bolagsverketResult, allabolagResult] = await Promise.allSettled([
    hamtaFranBolagsverket(orgnr),
    sokForetag(orgnr, 1),
  ]);

  if (bolagsverketResult.status === "rejected") {
    console.error("Bolagsverket-uppslag misslyckades:", bolagsverketResult.reason?.message);
  }

  const bv = bolagsverketResult.status === "fulfilled" ? bolagsverketResult.value : null;
  const ab =
    allabolagResult.status === "fulfilled" && allabolagResult.value[0]?.orgnr === formatOrgnr(orgnr)
      ? allabolagResult.value[0]
      : null;

  if (!bv && !ab) {
    return { hittad: false, fel: "ej-hittad" };
  }

  // Besöksadressen hos allabolag är oftare den ort en admin känner igen än
  // Bolagsverkets postadress, som kan vara en box eller ett redovisningsbyråkontor.
  const adressKalla = ab?.gatuadress ? ab : bv?.gatuadress ? bv : ab || bv;

  const result = {
    hittad: true,
    orgnr: formatOrgnr(orgnr),
    namn: bv?.namn || ab?.namn || "",
    // Både delarna var för sig (formuläret har ett fält per del) och den
    // sammanslagna raden, som är den form adressen lagras i.
    gatuadress: adressKalla?.gatuadress || "",
    postnummer: formatPostnummer(adressKalla?.postnummer || ""),
    postort: titleCaseOrt(adressKalla?.postort || ""),
    adress: composeAddress(adressKalla || {}),
    bolagsform: bv?.bolagsform || "",
    registreringsdatum: bv?.registreringsdatum || "",
    anstallda: ab?.anstallda || "",
    sni: bv?.sni || [],
    aktiv: bv?.aktiv ?? null,
    avregistrerad: bv?.avregistrerad ?? false,
    kallor: [bv ? "Bolagsverket" : null, ab ? "allabolag.se" : null].filter(Boolean),
  };

  cacheSet(cacheKey, result);
  return result;
}
