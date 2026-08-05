import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

function domainOf(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
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

  const { userId, email, companyName, orgNumber, address, website } = body;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    typeof userId !== "string" ||
    !UUID_RE.test(userId) ||
    typeof email !== "string" ||
    !EMAIL_RE.test(email) ||
    email.length > 254 ||
    !isValidText(companyName, 200) ||
    !isValidText(orgNumber, 20) ||
    !isValidText(address, 300) ||
    !isValidText(website, 200)
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  const websiteDomain = domainOf(website.trim());
  const emailDomain = email.split("@")[1]?.toLowerCase();

  if (!websiteDomain || emailDomain !== websiteDomain) {
    return NextResponse.json(
      { error: `E-postadressen måste matcha bolagets webbplats (${websiteDomain || "okänd domän"}).` },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("company_admins").insert({
    user_id: userId,
    company_id: null,
    claimed_company_name: companyName.trim(),
    claimed_org_number: orgNumber.trim(),
    claimed_address: address.trim(),
    claimed_website: website.trim(),
    verified: false,
  });

  if (error) {
    console.error("Kunde inte spara bolagsanspråk:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara begäran. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
