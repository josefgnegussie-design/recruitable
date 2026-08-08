import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Kopplar en KOLLEGA som redan skapat ett eget konto (via /for-bolag/registrera)
// till samma bolag som den inloggade, verifierade administratören. Ingen
// inbjudan skickas — kollegan måste redan finnas som auth-användare, och den
// befintliga administratören går i god för att koppla ihop dem direkt.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-lagg-till-anvandare", 20, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  const { data: callerRow } = await supabase
    .from("company_admins")
    .select("company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerRow?.verified || !callerRow.company_id) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Admin-API:et har inget direkt "sök på e-post" — vi listar och letar
  // manuellt. Fungerar bra i den här skalan (ett litet antal bolagskonton).
  let foundUser = null;
  let page = 1;
  while (!foundUser) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    foundUser = data.users.find((u) => u.email?.toLowerCase() === email) || null;
    if (data.users.length < 1000) break;
    page += 1;
  }

  if (!foundUser) {
    return NextResponse.json(
      { error: "Hittar inget konto med den e-postadressen. Personen behöver skapa ett konto via \"Skapa konto\" först." },
      { status: 404 }
    );
  }

  const { data: existing } = await admin
    .from("company_admins")
    .select("id")
    .eq("user_id", foundUser.id)
    .eq("company_id", callerRow.company_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Den personen är redan kopplad till bolaget." }, { status: 400 });
  }

  const { error: insertError } = await admin.from("company_admins").insert({
    user_id: foundUser.id,
    company_id: callerRow.company_id,
    verified: true,
  });

  if (insertError) {
    console.error("Kunde inte lägga till användare:", JSON.stringify(insertError));
    return NextResponse.json({ error: "Kunde inte lägga till användaren. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: foundUser.email });
}
