import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe anropar den här routen direkt (inte via klienten), och verifierar
// sig med en signatur i headern — därför läses kroppen som rå text istället
// för JSON, annars går signaturkontrollen inte att göra.
export async function POST(request) {
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Saknar signatur eller konfiguration." }, { status: 400 });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Ogiltig Stripe-webhooksignatur:", err.message);
    return NextResponse.json({ error: "Ogiltig signatur." }, { status: 400 });
  }

  const admin = createAdminClient();

  async function setPremium(companyId, { premium, customerId, subscriptionId }) {
    if (!companyId) return;
    const update = { is_premium: premium };
    if (customerId) update.stripe_customer_id = customerId;
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    if (premium) update.premium_since = new Date().toISOString();

    const { error } = await admin.from("companies").update(update).eq("id", Number(companyId));
    if (error) console.error(`Kunde inte uppdatera premium-status för bolag ${companyId}:`, JSON.stringify(error));
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const companyId = session.metadata?.companyId || session.client_reference_id;
      await setPremium(companyId, {
        premium: true,
        customerId: session.customer,
        subscriptionId: session.subscription,
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const companyId = subscription.metadata?.companyId;
      const active = subscription.status === "active" || subscription.status === "trialing";
      if (companyId) {
        await setPremium(companyId, { premium: active, customerId: subscription.customer, subscriptionId: subscription.id });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const companyId = subscription.metadata?.companyId;
      if (companyId) {
        await setPremium(companyId, { premium: false });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
