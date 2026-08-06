import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recruitables egen manuella granskning — släpper en accepterad förfrågans
// kontaktuppgifter till bolaget. Separat spärr utöver bolagets egen
// Acceptera-knapp, se lib/inquiries.js.
export async function POST(request) {
  const limited = await rateLimit(request, "admin-slapp-uppgifter", 60, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { recipientId } = body;
  if (typeof recipientId !== "string" || !recipientId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: recipient } = await admin
    .from("inquiry_recipients")
    .select("status")
    .eq("id", recipientId)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (recipient.status !== "accepted") {
    return NextResponse.json({ error: "Bolaget har inte accepterat förfrågan än." }, { status: 400 });
  }

  const { error } = await admin
    .from("inquiry_recipients")
    .update({ released_at: new Date().toISOString() })
    .eq("id", recipientId);

  if (error) {
    console.error("Kunde inte släppa kontaktuppgifter:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte släppa kontaktuppgifter." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
