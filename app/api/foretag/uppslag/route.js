import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { isOrgnr, slaUppOrgnr } from "@/lib/foretagsuppslag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fullständigt uppslag på ett organisationsnummer: används både när en admin väljer
// ett bolag ur förslagslistan och när hen skriver in org.numret för hand.
export async function GET(request) {
  const limited = await rateLimit(request, "foretag-uppslag", 60, 3600);
  if (limited) return limited;

  const orgnr = (request.nextUrl.searchParams.get("orgnr") || "").trim();

  if (!isOrgnr(orgnr)) {
    return NextResponse.json({ error: "Ange ett organisationsnummer med tio siffror." }, { status: 400 });
  }

  const uppslag = await slaUppOrgnr(orgnr);

  if (!uppslag.hittad) {
    return NextResponse.json(
      { error: "Hittade inget bolag med det organisationsnumret. Fyll i uppgifterna för hand." },
      { status: 404 }
    );
  }

  return NextResponse.json(uppslag);
}
