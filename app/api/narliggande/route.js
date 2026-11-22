import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { rensaFraga, sokNarliggande } from "@/lib/narliggande";

export const runtime = "nodejs";

// Kartan "Bolag nära er" på Rekrytera och Upphandling. Öppen route utan
// inloggning: svaret är bolagsnamn och orter som redan är publika i registret.
// Adresserna loggas inte och sparas inte.
export async function POST(request) {
  const limited =
    (await rateLimit(request, "narliggande-min", 20, 60)) || (await rateLimit(request, "narliggande-dag", 300, 86400));
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const fraga = rensaFraga(body);
  if (!fraga.adresser.length) {
    return NextResponse.json({ error: "Skriv in minst en adress." }, { status: 400 });
  }

  return NextResponse.json(await sokNarliggande(fraga));
}
