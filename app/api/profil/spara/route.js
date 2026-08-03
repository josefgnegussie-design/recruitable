import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  const { companyId, extendedVision } = await request.json();

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("verified")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!adminRow?.verified) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const { error } = await supabase
    .from("companies")
    .update({ extended_vision: extendedVision, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) {
    console.error("Kunde inte spara profil:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
