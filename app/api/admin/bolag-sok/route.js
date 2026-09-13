import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { sokBolag } from "@/lib/bolagsSok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sökning i registret för granskningsköerna. Kontoansökningar matchas automatiskt
// på organisationsnummer, men tusentals importerade bolag saknar numret — då
// hittar matchningen ingenting och godkännandet skulle skapa ett dubblettbolag
// bredvid den profil som redan finns. Med den här går bolaget att söka fram och
// koppla för hand i stället. Samma uppslag pekar ut det överlevande bolaget i
// sammanslagningskön.
//
// Egen route och inte /api/bolag/sok: den söker på yrkesområde, tjänst och ort
// för besökare, medan granskaren söker på namn eller organisationsnummer och
// behöver se även bolag utan beskrivning. Själva uppslaget ligger i
// lib/bolagsSok.js och delas med bolagens egen väg in, /api/mina-sidor/bolag-sok.
export async function GET(request) {
  const limited = await rateLimit(request, "admin-bolag-sok", 120, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const { traffar, fel } = await sokBolag(
    createAdminClient(),
    request.nextUrl.searchParams.get("q") || ""
  );

  if (fel) {
    console.error("Kunde inte söka i registret:", JSON.stringify(fel));
    return NextResponse.json({ error: "Sökningen misslyckades." }, { status: 500 });
  }

  return NextResponse.json({ traffar });
}
