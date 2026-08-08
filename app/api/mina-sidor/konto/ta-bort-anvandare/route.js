import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tar bort en annan administratörs koppling till bolaget (t.ex. vid byte av
// kontaktperson). Man kan inte ta bort sig själv härifrån — då tvingas det
// göras av en kvarvarande administratör, så ett bolag aldrig blir utan admin
// av misstag.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-ta-bort-anvandare", 20, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { adminRowId } = body;
  if (typeof adminRowId !== "string" || !UUID_RE.test(adminRowId)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: callerRow } = await supabase
    .from("company_admins")
    .select("id, company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerRow?.verified || !callerRow.company_id) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  if (callerRow.id === adminRowId) {
    return NextResponse.json(
      { error: "Du kan inte ta bort dig själv. Be en kollega med åtkomst göra det." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: targetRow } = await admin
    .from("company_admins")
    .select("id, company_id")
    .eq("id", adminRowId)
    .maybeSingle();

  if (!targetRow || targetRow.company_id !== callerRow.company_id) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  const { error: deleteError } = await admin.from("company_admins").delete().eq("id", adminRowId);

  if (deleteError) {
    console.error("Kunde inte ta bort användare:", JSON.stringify(deleteError));
    return NextResponse.json({ error: "Kunde inte ta bort användaren. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
