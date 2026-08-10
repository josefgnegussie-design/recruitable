import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Öppnar Stripes egen "Billing Portal" så ett bolag kan hantera eller säga
// upp sin prenumeration själva — vi bygger inget eget gränssnitt för det.
export async function POST(request) {
  const limited = await rateLimit(request, "stripe-portal", 10, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow?.verified || !adminRow.company_id) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", adminRow.company_id)
    .maybeSingle();

  if (!company?.stripe_customer_id) {
    return NextResponse.json({ error: "Ingen prenumeration hittades." }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: `${origin}/mina-sidor`,
  });

  return NextResponse.json({ url: session.url });
}
