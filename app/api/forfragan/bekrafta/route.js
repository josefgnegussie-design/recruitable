import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { hashaToken, rimligToken } from "@/lib/inbjudningar";
import { bekraftaForfragan } from "@/lib/automatiskGranskning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Avsändaren trycker på "Bekräfta och skicka" på uppföljningssidan, dit
// knappen i mejlet leder. Ett POST och inte själva länken i mejlet: e-post-
// skydd som Outlooks Safe Links öppnar länkar i förväg, och hade då bekräftat
// förfrågan åt den vars adress någon annan skrivit in.
export async function POST(request) {
  const limited = await rateLimit(request, "forfragan-bekrafta", 20, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { token, bekrafta } = body || {};
  if (!rimligToken(token) || !rimligToken(bekrafta)) {
    return NextResponse.json({ error: "Länken är inte giltig." }, { status: 404 });
  }

  try {
    const resultat = await bekraftaForfragan(createAdminClient(), {
      uppfoljningsHash: hashaToken(token),
      bekraftelseToken: bekrafta,
    });
    if (!resultat) return NextResponse.json({ error: "Länken är inte giltig." }, { status: 404 });
    return NextResponse.json({ ok: true, status: resultat.status });
  } catch {
    return NextResponse.json({ error: "Kunde inte bekräfta förfrågan. Försök igen." }, { status: 500 });
  }
}
