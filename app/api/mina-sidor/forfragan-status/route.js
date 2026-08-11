import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { sendRecipientDecisionToAdmin } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["accepted", "declined"]);

// Bolagets Acceptera/Neka på Mina sidor. Går via en serverroute istället för
// ett direkt Supabase-anrop från klienten (som tidigare) så att beslutet
// också triggar en mejlnotis till plattformsadmin — se
// sendRecipientDecisionToAdmin i lib/email.js och /admin/logg.
export async function POST(request) {
  const limited = await rateLimit(request, "mina-sidor-forfragan-status", 60, 3600);
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

  const { recipientId, status } = body;
  if (typeof recipientId !== "string" || !recipientId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: recipient } = await supabase
    .from("inquiry_recipients")
    .select("company_id, companies(name), inquiries(requester_company, description)")
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

  const { error } = await supabase
    .from("inquiry_recipients")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", recipientId);

  if (error) {
    console.error("Kunde inte uppdatera status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }

  await sendRecipientDecisionToAdmin({
    inquiry: {
      requesterCompany: recipient.inquiries?.requester_company,
      description: recipient.inquiries?.description,
    },
    companyName: recipient.companies?.name || "Ett bolag",
    decision: status,
  });

  return NextResponse.json({ ok: true });
}
