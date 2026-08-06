import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { INQUIRIES_PAGE_SIZE, mapInquiryRow } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// Hämtar nästa sida av ett bolags förfrågningar (äldre än `before`), med
// samma server-side redigering av kontaktuppgifter som förstasidan i
// app/mina-sidor/page.js.
export async function POST(request) {
  const limited = await rateLimit(request, "forfragan-lista", 60, 3600);
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

  const { before } = body;
  if (typeof before !== "string" || !ISO_DATE_RE.test(before)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow?.verified || !adminRow.company_id) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const { data: inquiryRows, error } = await supabase
    .from("inquiry_recipients")
    .select("id, created_at, status, released_at, inquiries(*)")
    .eq("company_id", adminRow.company_id)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(INQUIRIES_PAGE_SIZE + 1);

  if (error) {
    console.error("Kunde inte hämta fler förfrågningar:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte hämta fler förfrågningar." }, { status: 500 });
  }

  const rows = inquiryRows || [];
  const hasMore = rows.length > INQUIRIES_PAGE_SIZE;
  const inquiries = rows
    .slice(0, INQUIRIES_PAGE_SIZE)
    .filter((row) => row.inquiries)
    .map(mapInquiryRow);

  return NextResponse.json({ inquiries, hasMore });
}
