import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaBolag, SIDSTORLEK } from "@/lib/companiesRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sökning i bolagsregistret, en sida i taget. Finns för att /rekrytera och
// matchningsflödet ska kunna söka utan att först ladda hem hela registret —
// det som i dag sker genom att den statiska listan importeras i klientkoden.
export async function GET(request) {
  const limited = await rateLimit(request, "bolag-sok", 120, 3600);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;

  const resultat = await hamtaBolag({
    omrade: (params.get("omrade") || "").slice(0, 100),
    tjanst: (params.get("tjanst") || "").slice(0, 100),
    ort: (params.get("ort") || "").slice(0, 100),
    sida: params.get("sida") || 1,
    antal: params.get("antal") || SIDSTORLEK,
  });

  return NextResponse.json(resultat);
}
