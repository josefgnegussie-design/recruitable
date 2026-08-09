import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { sendPasswordChangedEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Skickar en säkerhetsnotis till den inloggade användarens EGEN e-post efter
// ett lyckat lösenordsbyte i Kontofliken. Tar inte emot någon adress från
// klienten — mejlet går alltid till den redan inloggade sessionens e-post,
// så det går inte att missbruka för att skicka mejl till någon annan.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-losenord-bytt", 10, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  await sendPasswordChangedEmail(user.email);

  return NextResponse.json({ ok: true });
}
