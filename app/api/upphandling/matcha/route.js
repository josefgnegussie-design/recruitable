import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { matchaUpphandling, rensaKriterier } from "@/lib/upphandlingMatchning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Relevanta bolag för en upphandling under arbete. Anropas medan köparen fyller
// i formuläret, därför ett generöst tak. Svaret bär bara det som redan står på
// de publika profilerna — inga kontaktadresser.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-matcha", 300, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  return NextResponse.json(await matchaUpphandling(rensaKriterier(body)));
}
