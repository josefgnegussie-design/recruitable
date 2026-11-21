import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { slappForfragan } from "@/lib/automatiskGranskning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// approved/rejected: beslut om en förfrågan i granskningskön.
// withdrawn: en redan godkänd förfrågan dras tillbaka. Den blir 'rejected' och
// försvinner därmed ur bolagens Mina sidor (RLS släpper bara 'approved').
const VALID_DECISIONS = new Set(["approved", "rejected", "withdrawn"]);

// Recruitables egen granskning. De flesta förfrågningar godkänns automatiskt
// när avsändaren bekräftat sin adress (lib/automatiskGranskning.js). Hit kommer
// de som fastnade i någon kontroll, och tillbakadragningar av godkända.
//
// Godkännandet är också det som mejlar de valda bolagen, se slappForfragan.
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

  const nu = new Date().toISOString();

  if (decision === "withdrawn") {
    // moderated_at lämnas orört: det är när förfrågan blev synlig för bolagen.
    const { data: andrade, error } = await admin
      .from("inquiries")
      .update({ moderation_status: "rejected", moderated_by: "admin", tillbakadragen_at: nu })
      .eq("id", inquiryId)
      .eq("moderation_status", "approved")
      .select("id");
    if (error) {
      console.error("Kunde inte dra tillbaka förfrågan:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
    }
    if (!andrade?.length) {
      return NextResponse.json({ error: "Förfrågan är inte godkänd och kan inte dras tillbaka." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (inquiry.moderation_status !== "pending") {
    return NextResponse.json({ error: "Förfrågan är redan hanterad." }, { status: 400 });
  }

  // moderated_at är tidpunkten förfrågan blev synlig för bolagen, och därmed
  // den som avgör vilken månad den hör till i faktureringsunderlaget.
  // Villkoret på 'pending' hindrar två samtidiga klick från att mejla bolagen
  // två gånger.
  const { data: andrade, error } = await admin
    .from("inquiries")
    .update({ moderation_status: decision, moderated_at: nu, moderated_by: "admin" })
    .eq("id", inquiryId)
    .eq("moderation_status", "pending")
    .select("id");

  if (error) {
    console.error("Kunde inte uppdatera moderation_status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }
  if (!andrade?.length) {
    return NextResponse.json({ error: "Förfrågan är redan hanterad." }, { status: 400 });
  }

  if (decision !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const kvitto = await slappForfragan(admin, inquiryId);
  return NextResponse.json({ ok: true, ...kvitto });
}
