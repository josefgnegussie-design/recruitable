import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Skickar en sexsiffrig inloggningskod till ett befintligt konto.
//
// Går via servern och inte direkt från webbläsaren, av två skäl. Med
// shouldCreateUser: false svarar Supabase med ett fel för en adress som saknar
// konto — direkt i webbläsaren skulle det avslöja vilka bolag som har konton
// här. Och rutten kan begränsas per IP-adress, vilket Supabases egen gräns per
// mottagare inte gör.
//
// Kod och inte magisk länk: länken bygger på PKCE och fungerar bara i samma
// webbläsare som begärde den (se app/auth/confirm/route.js). En kod kan läsas
// i mobilen och skrivas in på datorn.
export async function POST(request) {
  const limited = await rateLimit(request, "inloggningskod", 5, 900);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const epost = typeof body.epost === "string" ? body.epost.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(epost) || epost.length > 254) {
    return NextResponse.json({ error: "Ange en giltig e-postadress." }, { status: 400 });
  }

  const { error } = await createPublicClient().auth.signInWithOtp({
    email: epost,
    options: { shouldCreateUser: false },
  });

  // Loggas men lämnas inte ut. En okänd adress och en känd får samma svar, och
  // ett fel hos Supabase (t.ex. dess egen gräns på ett mejl per minut) syns i
  // loggen i stället för i formuläret.
  if (error) console.error("Inloggningskod skickades inte:", error.message);

  return NextResponse.json({ ok: true });
}
