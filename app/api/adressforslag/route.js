import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { sokPostnummer } from "@/lib/postnummer";

export const runtime = "nodejs";

// Adressförslag medan man skriver i kartans sökfält. Förslagen kommer från
// Photon (photon.komoot.io), som bygger på OpenStreetMap och är gjord för
// sök-medan-du-skriver; Nominatim förbjuder det i sina villkor. Anropet går via
// servern, så att Photon bara får söktexten och aldrig besökarens IP-adress.
// Går Photon inte att nå föreslås orter ur vårt eget postnummerregister.

const SVERIGE_BBOX = "10.5,55.0,24.5,69.5";
const MAX = 6;
const cache = new Map();

function etikett(p) {
  const gata = [p.street || (p.type === "street" ? p.name : ""), p.housenumber].filter(Boolean).join(" ");
  const namn = !gata && p.name && p.name !== p.city ? p.name : "";
  const ort = [p.postcode, p.city || p.town || p.village || p.district].filter(Boolean).join(" ");
  return [namn, gata, ort || p.county].filter(Boolean).join(", ");
}

async function franPhoton(q) {
  const url =
    `${process.env.PHOTON_URL || "https://photon.komoot.io"}/api/?limit=10&bbox=${SVERIGE_BBOX}&q=` + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": "Recruitable (https://recruitable.se)" },
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Photon svarade ${res.status}`);
  const data = await res.json();
  const sedda = new Set();
  const ut = [];
  for (const f of data.features ?? []) {
    const p = f.properties ?? {};
    if (p.countrycode && p.countrycode !== "SE") continue;
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const text = etikett(p);
    if (!text || !Number.isFinite(lat) || !Number.isFinite(lng) || sedda.has(text)) continue;
    sedda.add(text);
    ut.push({ text, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 });
    if (ut.length >= MAX) break;
  }
  return ut;
}

export async function GET(request) {
  const limited =
    (await rateLimit(request, "adressforslag-min", 60, 60)) || (await rateLimit(request, "adressforslag-dag", 1500, 86400));
  if (limited) return limited;

  const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  if (q.length < 3) return NextResponse.json({ forslag: [] });

  const nyckel = q.toLowerCase();
  if (cache.has(nyckel)) return NextResponse.json({ forslag: cache.get(nyckel) });

  let forslag;
  try {
    forslag = await franPhoton(q);
  } catch (err) {
    console.error("Adressförslagen kunde inte hämtas:", err.message);
    // Reserv: orter och postnummer ur vårt eget register, utan koordinater.
    // Sökningen slår upp dem själv när besökaren väljer.
    forslag = sokPostnummer(q, MAX).map((p) => ({ text: p.postnummer ? `${p.postnummer} ${p.postort}` : p.postort }));
    return NextResponse.json({ forslag });
  }
  if (cache.size > 2000) cache.clear();
  cache.set(nyckel, forslag);
  return NextResponse.json({ forslag });
}
