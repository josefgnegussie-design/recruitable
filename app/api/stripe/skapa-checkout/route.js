import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Skapar en Stripe Checkout-session för att uppgradera det inloggade
// bolaget till premium. Bolaget väljs alltid utifrån den inloggade,
// verifierade administratörens egen koppling — aldrig från klienten,
// så ett bolag kan inte av misstag (eller avsikt) betala för ett annat.
export async function POST(request) {
  const limited = await rateLimit(request, "stripe-skapa-checkout", 10, 3600);
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

  if (!process.env.STRIPE_PREMIUM_PRICE_ID) {
    console.error("STRIPE_PREMIUM_PRICE_ID saknas.");
    return NextResponse.json({ error: "Betalning är inte konfigurerad än." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id, name, is_premium, stripe_customer_id")
    .eq("id", adminRow.company_id)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (company.is_premium) {
    return NextResponse.json({ error: "Bolaget är redan premium." }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
    customer: company.stripe_customer_id || undefined,
    customer_email: company.stripe_customer_id ? undefined : user.email,
    client_reference_id: String(company.id),
    metadata: { companyId: String(company.id) },
    subscription_data: { metadata: { companyId: String(company.id) } },
    success_url: `${origin}/mina-sidor?premium=klart`,
    cancel_url: `${origin}/mina-sidor?premium=avbrutet`,
  });

  return NextResponse.json({ url: session.url });
}
