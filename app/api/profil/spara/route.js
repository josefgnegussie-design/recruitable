import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request) {
  const limited = await rateLimit(request, "profil-spara", 30, 3600);
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

  const { companyId, extendedVision, mission, history, expertise, coverImage, logo, teamMembers, surveys } = body;

  function isValidLongText(v) {
    return typeof v === "string" && v.length <= 4000;
  }

  function isValidImageUrl(v) {
    if (v === "" || v === null || v === undefined) return true;
    if (typeof v !== "string" || v.length > 2000) return false;
    if (v.startsWith("/")) return true; // befintliga statiska tillgångar, t.ex. /logos/...
    try {
      const u = new URL(v);
      return u.protocol === "https:";
    } catch {
      return false;
    }
  }

  function isValidSurveyEntry(v) {
    if (v === null || v === undefined) return true;
    if (typeof v !== "object") return false;
    const { score, source } = v;
    return (
      typeof score === "number" &&
      score >= 1 &&
      score <= 5 &&
      typeof source === "string" &&
      source.length <= 200
    );
  }

  if (
    typeof companyId !== "number" ||
    !Number.isInteger(companyId) ||
    !isValidLongText(extendedVision) ||
    !isValidLongText(mission) ||
    !isValidLongText(history) ||
    !isValidLongText(expertise) ||
    !isValidImageUrl(coverImage) ||
    !isValidImageUrl(logo) ||
    !Array.isArray(teamMembers) ||
    teamMembers.length > 30 ||
    teamMembers.some(
      (m) =>
        typeof m.name !== "string" ||
        m.name.length > 100 ||
        typeof m.role !== "string" ||
        m.role.length > 100 ||
        !isValidImageUrl(m.photo_url)
    ) ||
    typeof surveys !== "object" ||
    surveys === null ||
    !isValidSurveyEntry(surveys.customer_satisfaction) ||
    !isValidSurveyEntry(surveys.employee_satisfaction)
  ) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

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
    .update({
      extended_vision: extendedVision,
      mission: mission,
      history: history,
      expertise: expertise,
      cover_image: coverImage || null,
      logo: logo || null,
      team_members: teamMembers,
      surveys: surveys,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (error) {
    console.error("Kunde inte spara profil:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
