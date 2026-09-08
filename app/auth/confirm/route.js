import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Landningssidan för länkarna i Supabases auth-mejl.
//
// Webbläsarklienten (lib/supabase/client.js) bygger på @supabase/ssr, som kör
// PKCE-flödet. Där räcker inte mallarnas {{ .ConfirmationURL }}: den lösningen
// förutsätter att samma webbläsare som begärde länken också öppnar den, eftersom
// kodverifieraren ligger i webbläsarens lagring. Mejlet öppnas i praktiken ofta
// i mobilen medan begäran gjordes på datorn, och då fastnar användaren.
//
// Mallarna pekar därför hit med en token-hash i stället, som växlas in mot en
// session på servern. Sessionen läggs i cookies av createClient, så sidan som
// användaren skickas vidare till hittar den direkt.
const TILLATNA_TYPER = new Set(["recovery", "signup", "email", "email_change"]);

// Var användaren hamnar om länken inte går att lösa in. Sidorna förklarar själva
// att länken är förbrukad och låter användaren begära en ny.
const FELSIDA = {
  recovery: "/aterstall-losenord?fel=lank",
  signup: "/logga-in?fel=lank",
  email: "/logga-in?fel=lank",
  email_change: "/logga-in?fel=lank",
};

// Bara sökvägar på den egna sajten. Utan den här kontrollen skulle ?next= kunna
// peka vidare till en främmande domän, med vår adress som avsändare.
function saker(next) {
  return typeof next === "string" && /^\/[^/\\]/.test(next) ? next : null;
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = saker(searchParams.get("next"));

  if (!tokenHash || !TILLATNA_TYPER.has(type)) {
    return NextResponse.redirect(new URL(FELSIDA[type] || "/logga-in?fel=lank", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Loggas utan token — själva felet säger vad som hände, och en förbrukad
    // eller utgången länk är det normala fallet, inte ett driftfel.
    console.error(`Kunde inte lösa in ${type}-länk:`, error.message);
    return NextResponse.redirect(new URL(FELSIDA[type], origin));
  }

  const standard = type === "recovery" ? "/aterstall-losenord" : "/mina-sidor";
  return NextResponse.redirect(new URL(next || standard, origin));
}
