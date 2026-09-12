import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { slaUppPostnummer, sokPostnummer } from "@/lib/postnummer";

export const runtime = "nodejs";

// Förslag till adressfältet på Mina sidor. Öppen route utan inloggning: datan är
// GeoNames offentliga postnummerregister och innehåller ingenting om bolagen.
// Taket är ändå högt satt men inte obegränsat — fältet gör ett anrop per paus i
// skrivandet, och en bolagsadmin som fyller i fem adresser kommer ingenstans
// nära gränsen.
export async function GET(request) {
  const limited = await rateLimit(request, "postnummer-sok", 300, 3600);
  if (limited) return limited;

  const q = (request.nextUrl.searchParams.get("q") || "").slice(0, 60);

  // Ett fullständigt postnummer behöver inget val ur listan — svaret räcker för
  // att fylla i postorten direkt.
  const exakt = slaUppPostnummer(q);

  return NextResponse.json({
    exakt,
    traffar: sokPostnummer(q),
  });
}
