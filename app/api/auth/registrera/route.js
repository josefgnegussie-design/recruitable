import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPANIES } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { userId, companyId, email } = body;

  if (
    typeof userId !== "string" ||
    !UUID_RE.test(userId) ||
    typeof companyId !== "number" ||
    !Number.isInteger(companyId) ||
    typeof email !== "string" ||
    !EMAIL_RE.test(email) ||
    email.length > 254
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "Okänt bolag." }, { status: 400 });
  }

  const companyDomain = domainOf(company.link);
  const emailDomain = email.split("@")[1]?.toLowerCase();

  if (!companyDomain || emailDomain !== companyDomain) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha bolagets webbplats (${companyDomain || "okänd domän"}).` },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("company_admins").insert({
    user_id: userId,
    company_id: companyId,
    verified: false,
  });

  if (error) {
    console.error("Kunde inte skapa company_admins-rad:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara begäran. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
