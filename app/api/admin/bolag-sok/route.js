import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sökning i registret för granskningskön. Kontoansökningar matchas automatiskt
// på organisationsnummer, men tusentals importerade bolag saknar numret — då
// hittar matchningen ingenting och godkännandet skulle skapa ett dubblettbolag
// bredvid den profil som redan finns. Med den här går bolaget att söka fram och
// koppla för hand i stället.
//
// Egen route och inte /api/bolag/sok: den söker på yrkesområde, tjänst och ort
// för besökare, medan granskaren söker på namn eller organisationsnummer och
// behöver se även bolag utan beskrivning.
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

  const fraga = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 120);
  if (fraga.length < 2) return NextResponse.json({ traffar: [] });

  const admin = createAdminClient();
  const siffror = fraga.replace(/\D/g, "");

  let sokning = admin.from("companies").select("id, name, org_number, city, address, claimed");

  if (siffror.length === 10) {
    // Organisationsnummer skrivs med eller utan bindestreck. Registret lagrar
    // det med, så båda formerna ska leda rätt.
    const medStreck = `${siffror.slice(0, 6)}-${siffror.slice(6)}`;
    sokning = sokning.or(`org_number.eq.${medStreck},org_number.eq.${siffror}`);
  } else {
    // Komma och parentes har egen betydelse i PostgREST-uttryck, så de plockas
    // bort innan värdet stoppas in — samma skäl som rensaOrt i companiesRepo.
    const rensad = fraga.replace(/[^\p{L}\p{N}\s&-]/gu, "").trim();
    if (!rensad) return NextResponse.json({ traffar: [] });
    sokning = sokning.ilike("name", `%${rensad}%`);
  }

  const { data, error } = await sokning.order("name").limit(10);

  if (error) {
    console.error("Kunde inte söka i registret:", JSON.stringify(error));
    return NextResponse.json({ error: "Sökningen misslyckades." }, { status: 500 });
  }

  return NextResponse.json({ traffar: data ?? [] });
}
