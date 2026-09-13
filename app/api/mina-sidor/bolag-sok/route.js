import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { kravBolagsadmin } from "@/lib/bolagsadmin";
import { sokBolag } from "@/lib/bolagsSok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bolagens egen sökning i registret. Behövs för att peka ut det andra bolaget i
// en sammanslagning: "vilket bolag är det som ska upphöra, och vilket lever
// vidare" kan bara bolaget självt svara på, och org.nummer räcker inte som
// inmatning eftersom tusentals importerade rader saknar det.
//
// Registret är publikt — namn, ort och organisationsnummer står på varje profil
// och i sitemapen — så det här öppnar inget som inte redan är öppet. Grinden är
// ändå på plats: uppslaget svarar bara verifierade bolagsadmins, så det inte blir
// ett bekvämt sätt att lasta ner hela registret.
export async function GET(request) {
  const limited = await rateLimit(request, "mina-sidor-bolag-sok", 120, 3600);
  if (limited) return limited;

  const { fel: behorighetsfel, admin } = await kravBolagsadmin();
  if (behorighetsfel) return behorighetsfel;

  const { traffar, fel } = await sokBolag(admin, request.nextUrl.searchParams.get("q") || "");

  if (fel) {
    console.error("Kunde inte söka i registret:", JSON.stringify(fel));
    return NextResponse.json({ error: "Sökningen misslyckades." }, { status: 500 });
  }

  return NextResponse.json({ traffar });
}
