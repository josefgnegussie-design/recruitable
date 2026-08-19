import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { composeAddress, isOrgnr, sokForetag, slaUppOrgnr } from "@/lib/foretagsuppslag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Förslagslista när en bolagsadmin skriver sitt företagsnamn i registreringen.
// Skrivs ett organisationsnummer in istället görs ett fullständigt uppslag direkt,
// så fältet fungerar likadant oavsett vad användaren råkar ha till hands.
export async function GET(request) {
  const limited = await rateLimit(request, "foretag-sok", 60, 3600);
  if (limited) return limited;

  const query = (request.nextUrl.searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ traffar: [] });
  }
  if (query.length > 120) {
    return NextResponse.json({ error: "Sökningen är för lång." }, { status: 400 });
  }

  if (isOrgnr(query)) {
    const uppslag = await slaUppOrgnr(query);
    if (!uppslag.hittad) return NextResponse.json({ traffar: [] });
    return NextResponse.json({
      traffar: [
        {
          namn: uppslag.namn,
          orgnr: uppslag.orgnr,
          gatuadress: uppslag.gatuadress,
          postnummer: uppslag.postnummer,
          postort: uppslag.postort,
          adress: uppslag.adress,
          anstallda: uppslag.anstallda,
        },
      ],
    });
  }

  const traffar = await sokForetag(query, 8);

  return NextResponse.json({
    traffar: traffar.map((t) => ({
      namn: t.namn,
      orgnr: t.orgnr,
      gatuadress: t.gatuadress,
      postnummer: t.postnummer,
      postort: t.postort,
      adress: composeAddress(t),
      anstallda: t.anstallda,
    })),
  });
}
