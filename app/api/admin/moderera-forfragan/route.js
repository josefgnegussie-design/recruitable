import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set(["approved", "rejected"]);

// Recruitables egen granskning av nyinkomna förfrågningar — ingen förfrågan
// syns för något bolag (inte ens redigerad) förrän den godkänts här. Se
// moderation_status i migration_inquiry_moderation.sql.
export async function POST(request) {
  const limited = await rateLimit(request, "admin-moderera-forfragan", 60, 3600);
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

  const { inquiryId, decision } = body;
  if (typeof inquiryId !== "string" || !inquiryId || !VALID_DECISIONS.has(decision)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: inquiry } = await admin
    .from("inquiries")
    .select("moderation_status")
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (inquiry.moderation_status !== "pending") {
    return NextResponse.json({ error: "Förfrågan är redan hanterad." }, { status: 400 });
  }

  const { error } = await admin
    .from("inquiries")
    .update({ moderation_status: decision })
    .eq("id", inquiryId);

  if (error) {
    console.error("Kunde inte uppdatera moderation_status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
