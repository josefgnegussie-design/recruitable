import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lämnar ut en förfrågans kontaktuppgifter (namn, e-post, roll) — men bara
// om den inloggade användaren är verifierad admin för mottagande bolag OCH
// förfrågan faktiskt är markerad som accepterad. Företagsnamn och ort syns
// redan innan dess i den vanliga listan, det är bara kontaktvägen som är låst.
export async function POST(request) {
  const limited = await rateLimit(request, "forfragan-detaljer", 30, 3600);
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

  const { recipientId } = body;
  if (typeof recipientId !== "string" || !recipientId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: recipient } = await supabase
    .from("inquiry_recipients")
    .select("company_id, status, inquiries(requester_name, requester_email, requester_role)")
    .eq("id", recipientId)
    .maybeSingle();

  if (!recipient) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("verified")
    .eq("user_id", user.id)
    .eq("company_id", recipient.company_id)
    .maybeSingle();

  if (!adminRow?.verified) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  if (recipient.status !== "accepted") {
    return NextResponse.json({ error: "Kontaktuppgifterna låses upp först när förfrågan accepterats." }, { status: 403 });
  }

  return NextResponse.json(recipient.inquiries);
}
