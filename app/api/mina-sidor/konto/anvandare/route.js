import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaAdministratorer, kravBolagsadmin, stamplaBolagsadmin } from "@/lib/bolagsadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Administratörerna för det inloggades bolag.
export async function GET() {
  const { fel, admin, rad } = await kravBolagsadmin();
  if (fel) return fel;

  return NextResponse.json({
    administratorer: await hamtaAdministratorer(admin, rad.company_id),
    duArAgare: rad.ar_agare,
  });
}

// Kopplar en kollega som redan har ett konto till samma bolag.
//
// Ingen inbjudan skickas och inget konto skapas: kollegan måste redan finnas
// som användare, och ägaren går i god för kopplingen. Att skapa konton åt andra
// skulle betyda att någon sätter ett lösenord åt någon annan, eller att en
// inbjudningslänk som ger tillgång till ett bolag skickas till en adress ingen
// kontrollerat.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-anvandare", 20, 3600);
  if (limited) return limited;

  const { fel, admin, rad } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const epost = typeof body.epost === "string" ? body.epost.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(epost) || epost.length > 254) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  // Admin-API:et saknar sökning på e-post, så listan gås igenom. Antalet konton
  // är litet — ett per bolag som tagit över sin profil.
  let hittad = null;
  for (let sida = 1; !hittad; sida++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: sida, perPage: 1000 });
    if (error || !data?.users?.length) break;
    hittad = data.users.find((u) => u.email?.toLowerCase() === epost) || null;
    if (data.users.length < 1000) break;
  }

  if (!hittad) {
    return NextResponse.json(
      { error: "Ingen användare med den adressen. Be kollegan registrera sig först." },
      { status: 404 }
    );
  }

  const { data: befintlig } = await admin
    .from("company_admins")
    .select("id, company_id")
    .eq("user_id", hittad.id)
    .maybeSingle();

  if (befintlig?.company_id === rad.company_id) {
    return NextResponse.json({ error: "Adressen är redan administratör här." }, { status: 400 });
  }
  if (befintlig?.company_id) {
    return NextResponse.json({ error: "Adressen är administratör för ett annat bolag." }, { status: 400 });
  }

  // Finns en oavslutad ansökan uppdateras den i stället för att en andra rad
  // skapas — annars hamnar kollegan både i granskningskön och bland bolagets
  // administratörer.
  const skrivning = befintlig
    ? admin
        .from("company_admins")
        .update({ company_id: rad.company_id, verified: true, ar_agare: false })
        .eq("id", befintlig.id)
    : admin
        .from("company_admins")
        .insert({ user_id: hittad.id, company_id: rad.company_id, verified: true, ar_agare: false });

  const { error } = await skrivning;
  if (error) {
    console.error("Kunde inte lägga till administratör:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte lägga till. Försök igen." }, { status: 500 });
  }

  await stamplaBolagsadmin(admin, hittad.id);

  return NextResponse.json({ administratorer: await hamtaAdministratorer(admin, rad.company_id) });
}

// Tar bort en administratör. Ägaren kan inte tas bort — ansvaret måste först
// lämnas över, annars står bolaget utan någon som kan hantera prenumerationen.
export async function DELETE(request) {
  const limited = await rateLimit(request, "konto-anvandare", 20, 3600);
  if (limited) return limited;

  const { fel, admin, rad } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { adminId } = body;
  if (typeof adminId !== "string" || !adminId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: mal } = await admin
    .from("company_admins")
    .select("id, company_id, ar_agare, user_id")
    .eq("id", adminId)
    .maybeSingle();

  if (!mal || mal.company_id !== rad.company_id) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }
  if (mal.ar_agare) {
    return NextResponse.json(
      { error: "Ägaren kan inte tas bort. Lämna över ansvaret till någon annan först." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("company_admins").delete().eq("id", adminId);
  if (error) {
    console.error("Kunde inte ta bort administratör:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte ta bort. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ administratorer: await hamtaAdministratorer(admin, rad.company_id) });
}
