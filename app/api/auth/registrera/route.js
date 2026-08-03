import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COMPANIES } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function POST(request) {
  const { userId, companyId, email } = await request.json();

  if (!userId || !companyId || !email) {
    return NextResponse.json({ error: "Ofullständig förfrågan." }, { status: 400 });
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
