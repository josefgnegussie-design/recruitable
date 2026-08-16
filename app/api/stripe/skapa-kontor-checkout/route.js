import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Skapar en Stripe Checkout-session för att lägga till ett nytt, betalt
// kontor under det inloggade bolaget. Kontoret skapas direkt som opaid —
// webhooken markerar det som betalt när checkout-sessionen slutförs (se
// checkout.session.completed i /api/stripe/webhook), samma mönster som
// gäller för companies.is_premium.
export async function POST(request) {
  const limited = await rateLimit(request, "stripe-skapa-kontor-checkout", 10, 3600);
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { city, address, contactName, contactEmail } = body;

  if (
    !isValidText(city, 100) ||
    !isValidText(contactName, 100) ||
    typeof contactEmail !== "string" ||
    !EMAIL_RE.test(contactEmail) ||
    contactEmail.length > 254 ||
    (address !== undefined && address !== null && (typeof address !== "string" || address.length > 300))
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  if (!process.env.STRIPE_OFFICE_PRICE_ID) {
    console.error("STRIPE_OFFICE_PRICE_ID saknas.");
    return NextResponse.json({ error: "Betalning för kontor är inte konfigurerad än." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("id, name, stripe_customer_id")
    .eq("id", adminRow.company_id)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  const { data: office, error: officeError } = await admin
    .from("offices")
    .insert({
      company_id: company.id,
      city: city.trim(),
      address: address?.trim() || null,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
    })
    .select("id")
    .single();

  if (officeError || !office) {
    console.error("Kunde inte skapa kontor:", JSON.stringify(officeError));
    return NextResponse.json({ error: "Kunde inte skapa kontoret. Försök igen." }, { status: 500 });
  }

  const stripe = getStripe();
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_OFFICE_PRICE_ID, quantity: 1 }],
    customer: company.stripe_customer_id || undefined,
    customer_email: company.stripe_customer_id ? undefined : user.email,
    client_reference_id: office.id,
    metadata: { officeId: office.id, companyId: String(company.id) },
    subscription_data: { metadata: { officeId: office.id, companyId: String(company.id) } },
    success_url: `${origin}/mina-sidor?kontor=klart`,
    cancel_url: `${origin}/mina-sidor?kontor=avbrutet`,
  });

  return NextResponse.json({ url: session.url });
}
