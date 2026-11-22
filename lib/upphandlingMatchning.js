// Vilka bolag i registret som passar en upphandling, räknat ur det köparen
// fyllt i: tjänst, yrkesområden och arbetsställen. ENDAST SERVERSIDAN — avstånden slås
// upp i postnummerregistret, som är en halv megabyte.
//
// Matchningen läser bara registret. Den skriver ingenting och mejlar ingen:
// köparen ser vilka bolag som finns innan något publiceras, och vilka som får
// besked avgörs fortfarande vid godkännandet (app/api/admin/moderera-upphandling).

import { COMPANIES } from "@/lib/companies";
import { arbetsstalleEtikett, arbetsstalleFran } from "@/lib/arbetsstalle";
import { distanceKm } from "@/lib/helpers";
import { koordinatForOrt, slaUppPostnummer } from "@/lib/postnummer";
import { createPublicClient } from "@/lib/supabase/public";
import { GILTIGA_TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { KRAV_MALL, MAX_OMRADEN, MAX_ORTER } from "@/lib/upphandling";
import { sorteradeIso } from "@/lib/iso";

// Avstånd från arbetsstället i stället för kommungränser. Registrets orter är
// postorter, och "Hisings Backa" eller "Västra Frölunda" är inga kommuner — en
// exakt namnjämförelse hade missat dem för Göteborg. Inom 25 km från
// arbetsstället räknas bolaget som på orten, inom 75 km som i närheten. Gränserna
// följer resevillkoren i kollektivavtalet, som räknas från arbetsstället.
export const PA_ORTEN_KM = 25;
export const NARA_KM = 75;

// Hur många bolag svaret bär med sig. Antalet räknas på alla, men listan
// begränsas: köparen behöver de mest relevanta, inte hela registret.
const MAX_I_SVARET = 60;

export const KOLUMNER =
  "id, name, slug, city, lat, lng, office_cities, addresses, focus, services, ka, auktorisation, " +
  "iso_certifications, claimed, logo, employees";

// Det köparen fyllt i, tvättat. Okända värden stryks i stället för att avvisas:
// panelen uppdateras medan formuläret fylls i, och ett halvfärdigt val ska ge
// färre träffar, inte ett fel.
export function rensaKriterier(b = {}) {
  const tjanst = GILTIGA_TJANSTER.has(b.tjanst) ? b.tjanst : "";
  const omraden = Array.isArray(b.omraden)
    ? [...new Set(b.omraden.filter((o) => Object.hasOwn(YRKESOMRADEN, o)))].slice(0, MAX_OMRADEN)
    : [];
  // Arbetsställena med koordinater. Samma adress två gånger räknas en gång.
  const sedda = new Set();
  const arbetsstallen = (Array.isArray(b.arbetsstallen) ? b.arbetsstallen : [])
    .map(arbetsstalleFran)
    .filter((a) => {
      if (!a) return false;
      const nyckel = arbetsstalleEtikett(a).toLowerCase();
      if (sedda.has(nyckel)) return false;
      sedda.add(nyckel);
      return true;
    })
    .slice(0, MAX_ORTER);
  const kravIds = new Set(Array.isArray(b.krav) ? b.krav.filter((k) => typeof k === "string") : []);
  const krav = KRAV_MALL.filter((k) => k.profil && kravIds.has(k.id));
  return { tjanst, omraden, arbetsstallen, krav };
}

// Registrets rader och den statiska filens bolag i samma form.
export function franRad(r) {
  return {
    id: r.id,
    namn: r.name,
    slug: r.slug ?? null,
    ort: r.city || "",
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    kontorsorter: r.office_cities ?? [],
    adresser: (r.addresses ?? []).filter((a) => typeof a === "object" && a),
    fokus: r.focus ?? [],
    tjanster: r.services ?? [],
    ka: Boolean(r.ka),
    auktorisation: r.auktorisation ?? [],
    iso: r.iso_certifications ?? [],
    aktiv: Boolean(r.claimed),
    logo: r.logo ?? null,
    medarbetare: r.employees ?? null,
  };
}

export function franStatisk(c) {
  return franRad({
    ...c,
    office_cities: c.officeCities,
    iso_certifications: c.iso,
    employees: c.employees,
  });
}

// Ett element i en Postgres-arraylitteral. Yrkesområdena kommer ur en fast
// lista utan citattecken eller bakstreck, men de escapas ändå.
function citera(v) {
  return `"${String(v).replace(/["\\]/g, "\\$&")}"`;
}

// Kandidaterna: bolag med minst ett av yrkesområdena, och tjänsten om den är
// vald. Orten filtreras här i koden och inte i frågan — avståndet går inte att
// uttrycka i PostgREST, och ett yrkesområde snävar redan in registret till några
// hundra rader.
async function hamtaKandidater({ tjanst, omraden }) {
  try {
    const supabase = createPublicClient();
    // Värdena citeras: supabase-js skriver arrayen som {a,b} utan citattecken,
    // och då delar Postgres "Lager, logistik och transport" i två element som
    // inget bolag har.
    let fraga = supabase
      .from("companies")
      .select(KOLUMNER)
      .overlaps("focus", omraden.map(citera))
      .is("retired_at", null);
    if (tjanst) fraga = fraga.contains("services", [citera(tjanst)]);
    const { data, error } = await fraga.limit(3000);
    if (error) throw error;
    return (data ?? []).map(franRad);
  } catch (err) {
    console.error("Matchningen kunde inte läsa registret, använder statiska filen:", err.message);
  }
  return COMPANIES.filter(
    (c) => (c.focus || []).some((f) => omraden.includes(f)) && (!tjanst || (c.services || []).includes(tjanst))
  ).map(franStatisk);
}

// Bolagets platser som koordinater: huvudorten, kontorsorterna och adresserna.
// En adress med postnummer ger en exakt punkt, annars postortens mitt.
export function platser(b) {
  const ut = [];
  const huvud = koordinatForOrt(b.ort) || (b.lat && b.lng ? { lat: b.lat, lng: b.lng } : null);
  if (huvud) ut.push(huvud);
  for (const o of b.kontorsorter) {
    const k = koordinatForOrt(o);
    if (k) ut.push(k);
  }
  for (const a of b.adresser) {
    const k = slaUppPostnummer(a.postal_code) || koordinatForOrt(a.city);
    if (k) ut.push({ lat: k.lat, lng: k.lng });
  }
  return ut;
}

function profilenUppfyller(krav, b) {
  if (krav.profil === "ka") return b.ka;
  if (krav.profil === "auktorisation") return b.auktorisation.length > 0;
  return sorteradeIso(b.iso).some((c) => c.kod === krav.profil);
}

export function matcha(kandidater, { omraden, arbetsstallen, krav }) {
  // `ort` är etiketten köparen känner igen: adressen och postorten.
  const malorter = arbetsstallen.map((a) => ({ ort: arbetsstalleEtikett(a), k: { lat: a.lat, lng: a.lng } }));

  const traffar = [];
  for (const b of kandidater) {
    const mina = platser(b);
    if (!mina.length) continue;

    const tackning = [];
    for (const { ort, k } of malorter) {
      const km = Math.min(...mina.map((p) => distanceKm(p.lat, p.lng, k.lat, k.lng)));
      if (km <= NARA_KM) tackning.push({ ort, km: Math.round(km), niva: km <= PA_ORTEN_KM ? "ort" : "nara" });
    }
    if (!tackning.length) continue;

    const omradenSomMatchar = b.fokus.filter((f) => omraden.includes(f));
    const uppfyllda = krav.filter((k) => profilenUppfyller(k, b)).map((k) => k.text);
    const paOrten = tackning.filter((t) => t.niva === "ort").length;

    traffar.push({
      id: b.id,
      namn: b.namn,
      profil: b.slug ? `/bolag/${b.slug}` : `/bolag/${b.id}`,
      ort: b.ort,
      logo: b.logo,
      medarbetare: b.medarbetare,
      aktiv: b.aktiv,
      tackning,
      omraden: omradenSomMatchar,
      krav: uppfyllda,
      // Orterna väger tyngst: ett bolag utan folk där uppdraget finns hjälper
      // inte köparen, hur väl det än passar i övrigt.
      poang: paOrten * 4 + (tackning.length - paOrten) * 2 + omradenSomMatchar.length + uppfyllda.length * 0.5,
    });
  }

  traffar.sort(
    (a, b) => b.poang - a.poang || Number(b.aktiv) - Number(a.aktiv) || a.namn.localeCompare(b.namn, "sv")
  );

  const perOrt = malorter.map(({ ort }) => {
    const har = traffar.filter((t) => t.tackning.some((x) => x.ort === ort));
    return {
      ort,
      paOrten: har.filter((t) => t.tackning.some((x) => x.ort === ort && x.niva === "ort")).length,
      nara: har.filter((t) => t.tackning.some((x) => x.ort === ort && x.niva === "nara")).length,
    };
  });

  return {
    totalt: traffar.length,
    aktiva: traffar.filter((t) => t.aktiv).length,
    perOrt,
    bolag: traffar.slice(0, MAX_I_SVARET).map(({ poang, ...t }) => t),
  };
}

export async function matchaUpphandling(kriterier) {
  if (!kriterier.omraden.length || !kriterier.arbetsstallen.length) {
    return { totalt: 0, aktiva: 0, perOrt: [], bolag: [], ofullstandig: true };
  }
  return matcha(await hamtaKandidater(kriterier), kriterier);
}

// Hur nära varje inbjudet bolag har till varje arbetsställe, för inbjudan. Bolaget
// ser sin egen rad ("8 km till 506 30 Borås"), så att det direkt ser vilket
// arbetsställe det är aktuellt för. Räknas när inbjudan skickas, med samma
// platser som matchningen. Ett bolag som inte går att läsa får ingen rad.
export async function narhetForBolag(companyIds, arbetsstallen) {
  try {
    const { data, error } = await createPublicClient().from("companies").select(KOLUMNER).in("id", companyIds);
    if (error) throw error;
    const narhet = {};
    for (const b of (data ?? []).map(franRad)) {
      const mina = platser(b);
      if (!mina.length) continue;
      narhet[b.id] = arbetsstallen
        .map((a) => ({
          postnummer: a.postnummer,
          postort: a.postort,
          km: Math.round(Math.min(...mina.map((p) => distanceKm(p.lat, p.lng, a.lat, a.lng)))),
        }))
        .filter((r) => r.km <= NARA_KM)
        .sort((x, y) => x.km - y.km);
    }
    return narhet;
  } catch (err) {
    console.error("Kunde inte räkna avstånd för inbjudan:", err.message);
    return null;
  }
}
