// Bolag nära en eller flera adresser, för kartan på Rekrytera och Upphandling.
// ENDAST SERVERSIDAN — adresserna slås upp i postnummerregistret, som är en
// halv megabyte, och registret läses med alla bolagens orter och adresser.
//
// Adresserna slås upp här och inte hos en karttjänst: det besökaren skriver
// lämnar aldrig Recruitable. Postnummerregistret har en punkt per postort, så
// ett postnummer ger postorten ("Västra Frölunda") och en ort utan postnummer
// ortens mitt. Registrets bolag ligger på samma nivå, så en gatuadress hade
// ändå inte gett exaktare avstånd.

import { COMPANIES } from "@/lib/companies";
import { distanceKm, kanoniskOrt } from "@/lib/helpers";
import { koordinatForOrt, slaUppPostnummer } from "@/lib/postnummer";
import { createPublicClient } from "@/lib/supabase/public";
import { YRKESOMRADEN, GILTIGA_TJANSTER } from "@/lib/taxonomy";
import { KOLUMNER, franRad, franStatisk, platser } from "@/lib/upphandlingMatchning";

export const MAX_ADRESSER = 5;
export const MAX_TECKEN = 120;
export const RADIER = [10, 25, 50, 75];
export const STANDARDRADIE = 25;
// Kartan klarar fler, men listan bredvid blir oläslig långt innan dess.
const MAX_I_SVARET = 150;

// Registret med varje bolags platser uträknade, sparat en stund per
// serverinstans. Kartan frågar per sökning, och att läsa tusentals rader varje
// gång vore slöseri när registret ändras några gånger om dagen.
const TTL_MS = 10 * 60 * 1000;
let cache = null;

async function lasRegistret() {
  const supabase = createPublicClient();
  const SKIVA = 1000;
  const rader = [];
  // Taket på tio skivor finns för att en trasig räkning aldrig ska bli en
  // oändlig loop.
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("companies")
      .select(KOLUMNER)
      .is("retired_at", null)
      .order("id")
      .range(i * SKIVA, i * SKIVA + SKIVA - 1);
    if (error) throw error;
    rader.push(...(data ?? []));
    if (!data || data.length < SKIVA) break;
  }
  return rader.map(franRad);
}

async function registret() {
  if (cache && Date.now() - cache.tid < TTL_MS) return cache.bolag;
  let bolag;
  try {
    bolag = await lasRegistret();
    if (!bolag.length) throw new Error("tomt register");
  } catch (err) {
    console.error("Kartan kunde inte läsa registret, använder statiska filen:", err.message);
    bolag = COMPANIES.map(franStatisk);
  }
  const medPlatser = bolag.map((b) => ({ ...b, platser: platser(b) })).filter((b) => b.platser.length);
  cache = { tid: Date.now(), bolag: medPlatser };
  return medPlatser;
}

// "Lindholmspiren 3, 417 56 Göteborg", "41756", "Borås" eller "Storgatan 1,
// Växjö". Postnumret vinner om det finns; annars den sista delen som är en ort.
export function tolkaAdress(text) {
  const t = String(text || "").trim().slice(0, MAX_TECKEN);
  if (!t) return null;

  const pn = t.match(/(?<!\d)(\d{3})\s?(\d{2})(?!\d)/);
  if (pn) {
    const post = slaUppPostnummer(pn[1] + pn[2]);
    if (post) {
      const gata = t.slice(0, pn.index).replace(/[,\s]+$/, "");
      return {
        text: t,
        etikett: gata ? `${gata}, ${post.postort}` : `${post.postnummer} ${post.postort}`,
        ort: kanoniskOrt(post.postort) || post.postort,
        lat: post.lat,
        lng: post.lng,
        exakthet: "postnummer",
      };
    }
  }

  // Delarna bakifrån: orten står oftast sist. Siffror (gatunummer) tas bort.
  const delar = t
    .split(",")
    .map((d) => d.replace(/\d+/g, "").trim())
    .filter(Boolean)
    .reverse();
  for (const del of delar) {
    const ort = kanoniskOrt(del) || del;
    const k = koordinatForOrt(ort) || koordinatForOrt(del);
    if (k) {
      const namn = kanoniskOrt(del) || versal(del);
      return { text: t, etikett: namn, ort: namn, lat: k.lat, lng: k.lng, exakthet: "ort" };
    }
  }
  return null;
}

function versal(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function rensaFraga(b = {}) {
  const adresser = (Array.isArray(b.adresser) ? b.adresser : [])
    .filter((a) => typeof a === "string" && a.trim())
    .map((a) => a.trim().slice(0, MAX_TECKEN))
    .slice(0, MAX_ADRESSER);
  const radie = RADIER.includes(Number(b.radie)) ? Number(b.radie) : STANDARDRADIE;
  const omrade = Object.hasOwn(YRKESOMRADEN, b.omrade) ? b.omrade : "";
  const tjanst = GILTIGA_TJANSTER.has(b.tjanst) ? b.tjanst : "";
  return { adresser, radie, omrade, tjanst };
}

export async function sokNarliggande({ adresser, radie, omrade, tjanst }) {
  const tolkade = adresser.map((a) => ({ a, p: tolkaAdress(a) }));
  const punkter = tolkade.filter((t) => t.p).map((t) => t.p);
  const ejHittade = tolkade.filter((t) => !t.p).map((t) => t.a);
  if (!punkter.length) return { punkter: [], ejHittade, bolag: [], totalt: 0 };

  const traffar = [];
  for (const b of await registret()) {
    if (omrade && !b.fokus.includes(omrade)) continue;
    if (tjanst && !b.tjanster.includes(tjanst)) continue;

    // Avståndet till varje adress räknas från bolagets närmaste plats, och
    // pricken på kartan sätts där: ett bolag med huvudkontor i Stockholm och
    // kontor i Göteborg ska synas i Göteborg när man söker där.
    let bast = null;
    const perAdress = punkter.map((p) => {
      let min = Infinity;
      for (const pl of b.platser) {
        const km = distanceKm(pl.lat, pl.lng, p.lat, p.lng);
        if (km < min) min = km;
        if (!bast || km < bast.km) bast = { km, lat: pl.lat, lng: pl.lng };
      }
      return Math.round(min * 10) / 10;
    });
    if (!bast || bast.km > radie) continue;

    traffar.push({
      id: b.id,
      namn: b.namn,
      profil: b.slug ? `/bolag/${b.slug}` : `/bolag/${b.id}`,
      ort: b.ort,
      aktiv: b.aktiv,
      lat: Math.round(bast.lat * 1e5) / 1e5,
      lng: Math.round(bast.lng * 1e5) / 1e5,
      km: Math.round(bast.km * 10) / 10,
      perAdress,
    });
  }

  traffar.sort((a, b) => a.km - b.km || Number(b.aktiv) - Number(a.aktiv) || a.namn.localeCompare(b.namn, "sv"));

  return {
    punkter: punkter.map(({ etikett, ort, lat, lng, exakthet }) => ({ etikett, ort, lat, lng, exakthet })),
    ejHittade,
    totalt: traffar.length,
    bolag: traffar.slice(0, MAX_I_SVARET),
  };
}
