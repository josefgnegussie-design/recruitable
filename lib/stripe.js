import Stripe from "stripe";

// Server-only Stripe-klient. Får aldrig importeras i "use client"-kod —
// STRIPE_SECRET_KEY är hemlig och ska bara finnas på servern.
let stripe;

export function getStripe() {
  if (!stripe) {
    // Ingen apiVersion anges — då används versionen som paketet self
    // faktiskt är byggt mot (se node_modules/stripe/cjs/apiVersion.js),
    // istället för att riskera att hårdkoda en föråldrad/felaktig sträng.
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}
