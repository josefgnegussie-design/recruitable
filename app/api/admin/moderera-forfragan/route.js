import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { resolveCompanyContacts } from "@/lib/offices";
import { sendInquiryReceivedToCompany } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set(["approved", "rejected"]);

// Recruitables egen granskning av nyinkomna förfrågningar — ingen förfrågan
// syns för något bolag (inte ens redigerad) förrän den godkänts här. Se
// moderation_status i migration_inquiry_moderation.sql.
//
// Godkännandet är också det som mejlar de valda bolagen. Mejlet hör hit och
// inte till /api/forfragan/skicka: skickas det vid inlämning har granskningen
// ingen verkan, eftersom bolaget redan fått förfrågan i mejlkorgen.
export async function POST(request) {
  const limited = await rateLimit(request, "admin-moderera-forfragan", 60, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { inquiryId, decision } = body;
  if (typeof inquiryId !== "string" || !inquiryId || !VALID_DECISIONS.has(decision)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Hämtar redan nu det mejlet behöver. En andra rundtur efter uppdateringen
  // hade gett samma uppgifter, och det här svaret behövs ändå för kontrollen
  // att förfrågan inte redan är hanterad.
  const { data: inquiry } = await admin
    .from("inquiries")
    .select(
      "moderation_status, description, search_role, focus_area, service, requester_company, requester_city, " +
        "inquiry_recipients(company_id, companies(id, name, contact, claimed))"
    )
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (inquiry.moderation_status !== "pending") {
    return NextResponse.json({ error: "Förfrågan är redan hanterad." }, { status: 400 });
  }

  // moderated_at är tidpunkten förfrågan blev synlig för bolagen, och därmed
  // den som avgör vilken månad den hör till i faktureringsunderlaget.
  // created_at duger inte: en förfrågan som kommer in sista dagen i månaden
  // och godkänns dagen efter hade annars fakturerats fel månad.
  const { error } = await admin
    .from("inquiries")
    .update({ moderation_status: decision, moderated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  if (error) {
    console.error("Kunde inte uppdatera moderation_status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }

  if (decision !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const valdaBolag = (inquiry.inquiry_recipients || []).map((r) => r.companies).filter(Boolean);

  // Bara bolag som kan göra något med mejlet får det: de har tagit över sin
  // profil och har en kontaktadress. Ett bolag som inte registrerat sig kan
  // varken logga in och acceptera eller förvänta sig mejl från oss — det hör
  // till informationsutskicket till registret, inte hit.
  const kanSvara = valdaBolag.filter((b) => b.claimed && b.contact);
  const mottagare = await resolveCompanyContacts(kanSvara, inquiry.requester_city);

  const forMejl = {
    description: inquiry.description,
    searchRole: inquiry.search_role || "",
    focusArea: inquiry.focus_area || "",
    service: inquiry.service || "",
    requesterCompany: inquiry.requester_company,
    requesterCity: inquiry.requester_city,
  };

  // Två bolag i samma koncern kan dela kontaktadress, och mejlet handlar om
  // förfrågan och inte om det enskilda bolaget — samma adress ska då ha ett mejl
  // och inte två identiska.
  const adresser = [...new Map(mottagare.map((m) => [m.email.toLowerCase(), m])).values()];

  // after() och inte fire-and-forget: registreringsnotisen försvann spårlöst i
  // produktion just för att utskicket startades utan await, och funktionen
  // frystes i samma ögonblick svaret gick iväg.
  if (adresser.length) {
    after(async () => {
      const utfall = await Promise.allSettled(
        adresser.map((m) => sendInquiryReceivedToCompany({ to: m.email, inquiry: forMejl }))
      );
      const fel = utfall.filter((u) => u.status === "rejected").length;
      if (fel) console.error(`Förfrågan ${inquiryId}: ${fel} av ${adresser.length} mejl gick inte ut.`);
    });
  }

  return NextResponse.json({
    ok: true,
    mejlade: mottagare.length,
    utanMottagare: valdaBolag.length - mottagare.length,
  });
}
