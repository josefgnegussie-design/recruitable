import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaAdministratorer, kravBolagsadmin } from "@/lib/bolagsadmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Administratörerna för det inloggades bolag.
export async function GET() {
  const { fel, admin, rad } = await kravBolagsadmin();
  if (fel) return fel;

  return NextResponse.json({
    administratorer: await hamtaAdministratorer(admin, rad.company_id),
    duArAgare: rad.ar_agare,
  });
}

// Kollegor läggs till med en inbjudan via mejl, se ../inbjudan/route.js. Den
// fungerar både för den som redan har ett konto och för den som saknar ett.

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
