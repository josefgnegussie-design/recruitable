import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";
import { sendContactAutoReply, sendContactNotificationToAdmin } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

export async function POST(request) {
  const limited = await rateLimit(request, "kontakt-skicka", 5, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { name, email, message, turnstileToken } = body;

  if (
    !isValidText(name, 100) ||
    typeof email !== "string" ||
    !EMAIL_RE.test(email) ||
    email.length > 254 ||
    !isValidText(message, 2000)
  ) {
    return NextResponse.json({ error: "Ofullständigt eller ogiltigt meddelande." }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();

  // Best effort — misslyckade utskick returnerar inte fel till avsändaren,
  // det finns inget att spara/återförsöka för ett kontaktmeddelande.
  await Promise.allSettled([
    sendContactNotificationToAdmin({ name: trimmedName, email: trimmedEmail, message: trimmedMessage }),
    sendContactAutoReply({ to: trimmedEmail, name: trimmedName }),
  ]);

  return NextResponse.json({ ok: true });
}
