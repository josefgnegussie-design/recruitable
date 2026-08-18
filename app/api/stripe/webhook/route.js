import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

  // Stripe hinner försöka dra betalningen flera gånger innan en
  // prenumeration faktiskt avslutas. Under den tiden (past_due/unpaid) är
  // bolaget fortfarande kund och behåller sin profil.
  const GRACE_DAYS = 7;

  // current_period_end ligger på prenumerationsraden i nyare API-versioner
  // (paketet kör 2026-07-29.dahlia) — läser båda platserna för säkerhets skull.
  function premiumUntilFrom(subscription) {
    const end =
      subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
    if (!end) return null;
    return new Date((end + GRACE_DAYS * 24 * 60 * 60) * 1000).toISOString();
  }

  async function setPremium(companyId, { premium, customerId, subscriptionId, premiumUntil }) {
    if (!companyId) return;
    const update = { is_premium: premium };
    if (customerId) update.stripe_customer_id = customerId;
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    if (premium) update.premium_since = new Date().toISOString();
    if (premiumUntil !== undefined) update.premium_until = premiumUntil;

    const { error } = await admin.from("companies").update(update).eq("id", Number(companyId));
    // Kastas vidare så att routen svarar med fel och Stripe gör om leveransen.
    // Sväljs felet här tror Stripe att allt gick bra och statusen blir
    // permanent fel — bolaget står kvar som obetalt trots betalning.
    if (error) throw new Error(`Kunde inte uppdatera premium-status för bolag ${companyId}: ${JSON.stringify(error)}`);

    // Profilsidan är ISR-cachad; utan detta syns köpet först efter
    // omvalideringsfönstret.
    revalidatePath(`/bolag/${companyId}`);
  }

  // Samma sak som setPremium, men för ett enskilt kontor (se
  // /api/stripe/skapa-kontor-checkout) istället för hela bolaget.
  async function setOfficePaid(officeId, { paid, subscriptionId, checkoutSessionId }) {
    if (!officeId) return;
    const update = { paid };
    if (subscriptionId) update.stripe_subscription_id = subscriptionId;
    if (checkoutSessionId) update.stripe_checkout_session_id = checkoutSessionId;

    const { error } = await admin.from("offices").update(update).eq("id", officeId);
    if (error) throw new Error(`Kunde inte uppdatera betalstatus för kontor ${officeId}: ${JSON.stringify(error)}`);
  }

  // Allt som rör statusskrivning ligger i try/catch: misslyckas skrivningen
  // ska routen svara med fel, så att Stripe levererar om eventet (upp till
  // tre dygn). Ett 200-svar på en misslyckad skrivning gör felet permanent.
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const officeId = session.metadata?.officeId;
        if (officeId) {
          await setOfficePaid(officeId, {
            paid: true,
            subscriptionId: session.subscription,
            checkoutSessionId: session.id,
          });
          break;
        }
        const companyId = session.metadata?.companyId || session.client_reference_id;
        // Sessionen bär ingen periodinformation — hämtar prenumerationen så att
        // premium_until är satt från första stund och bevakningen har ett facit.
        let premiumUntil;
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            premiumUntil = premiumUntilFrom(subscription);
          } catch (err) {
            console.error(`Kunde inte hämta prenumeration ${session.subscription}:`, err.message);
          }
        }
        await setPremium(companyId, {
          premium: true,
          customerId: session.customer,
          subscriptionId: session.subscription,
          premiumUntil,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const status = subscription.status;
        const paying = status === "active" || status === "trialing";
        // Betalningen har fallerat men prenumerationen lever — Stripe gör fler
        // försök. Rör inte statusen, annars släcks profilen för en kund som
        // med all sannolikhet betalar inom något dygn.
        const inDunning = status === "past_due" || status === "unpaid";

        const officeId = subscription.metadata?.officeId;
        if (officeId) {
          if (!inDunning) await setOfficePaid(officeId, { paid: paying, subscriptionId: subscription.id });
          break;
        }

        const companyId = subscription.metadata?.companyId;
        if (!companyId) break;

        if (inDunning) {
          console.warn(`Bolag ${companyId}: prenumerationen är ${status}, behåller premium under respitperioden.`);
          break;
        }

        await setPremium(companyId, {
          premium: paying,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          premiumUntil: paying ? premiumUntilFrom(subscription) : null,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const officeId = subscription.metadata?.officeId;
        if (officeId) {
          await setOfficePaid(officeId, { paid: false });
          break;
        }
        const companyId = subscription.metadata?.companyId;
        if (companyId) {
          await setPremium(companyId, { premium: false, premiumUntil: null });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Webhook ${event.type} kunde inte behandlas:`, err.message);
    return NextResponse.json({ error: "Kunde inte behandla eventet." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
