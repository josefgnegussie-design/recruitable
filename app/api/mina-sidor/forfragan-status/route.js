import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { sendAcceptanceToRequester, sendRecipientDecisionToAdmin } from "@/lib/email";
import { MAX_ORD_I_SVAR, fornamn, giltigtSvarsmeddelande } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["accepted", "declined"]);

// Bolagets Acceptera/Neka på Mina sidor. Går via en serverroute istället för
// ett direkt Supabase-anrop från klienten (som tidigare) så att beslutet
// också triggar en mejlnotis till plattformsadmin — se
// sendRecipientDecisionToAdmin i lib/email.js och /admin/logg.
export async function POST(request) {
  const limited = await rateLimit(request, "mina-sidor-forfragan-status", 60, 3600);
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

  const { recipientId, status, meddelande } = body;
  if (typeof recipientId !== "string" || !recipientId || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  if (!giltigtSvarsmeddelande(meddelande)) {
    return NextResponse.json(
      { error: `Meddelandet får vara högst ${MAX_ORD_I_SVAR} ord.` },
      { status: 400 }
    );
  }

  const svarsmeddelande = typeof meddelande === "string" ? meddelande.trim() || null : null;

  // Service role: bolagen har inte längre select på inquiries
  // (migration_forfragan_sekretess.sql). requester_company läses bara för
  // notismejlet till oss själva och lämnar aldrig servern — svaret härifrån är
  // { ok: true }.
  const { data: recipient } = await createAdminClient()
    .from("inquiry_recipients")
    .select(
      "company_id, companies(name, slug), " +
        "inquiries(moderation_status, requester_company, requester_name, requester_email, " +
        "description, search_role, city)"
    )
    .eq("id", recipientId)
    .maybeSingle();

  // Modereringsgrinden satt tidigare i RLS-policyn på inquiry_recipients, som
  // slog upp inquiries.moderation_status. Den uppslagningen fungerar inte längre
  // när bolagen saknar select på inquiries, och servicerollen går förbi RLS helt
  // — så grinden måste stå här i koden i stället.
  if (!recipient || recipient.inquiries?.moderation_status !== "approved") {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("verified")
    .eq("user_id", user.id)
    .eq("company_id", recipient.company_id)
    .maybeSingle();

  if (!adminRow?.verified) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  // Också skrivningen går via service role. Update-policyn på inquiry_recipients
  // rör i sig inte inquiries, men Postgres tillämpar SELECT-policyn när en UPDATE
  // ska hitta raden via WHERE — och den policyn slår upp inquiries. Med bolagets
  // egen session träffade uppdateringen därför noll rader, helt tyst: knappen
  // Neka gjorde ingenting och inget fel syntes någonstans.
  const { error } = await createAdminClient()
    .from("inquiry_recipients")
    .update({
      status,
      responded_at: new Date().toISOString(),
      response_message: svarsmeddelande,
    })
    .eq("id", recipientId);

  if (error) {
    console.error("Kunde inte uppdatera status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }

  const bolagsnamn = recipient.companies?.name || "Bolaget";
  const kundensEpost = recipient.inquiries?.requester_email;

  // Två mottagare, olika syften: notisen till oss är driftinformation, beskedet
  // till kunden är hela poängen med att bolaget svarar. Beslutet är redan sparat
  // — ett mejl som inte går fram får inte göra om svaret.
  await Promise.allSettled([
    sendRecipientDecisionToAdmin({
      inquiry: {
        requesterCompany: recipient.inquiries?.requester_company,
        description: recipient.inquiries?.description,
      },
      companyName: bolagsnamn,
      decision: status,
    }),
    // Bara accept skickas direkt. Ett nej väntar på dygnssammanställningen i
    // /api/cron/nekanden — den som frågat tio bolag ska inte få tio besvikelser
    // i rad, och ett samlat besked kan dessutom säga hur det gick för förfrågan
    // i stort, vilket ett enskilt nej inte kan.
    kundensEpost && status === "accepted"
      ? sendAcceptanceToRequester({
          to: kundensEpost,
          requesterName: fornamn(recipient.inquiries?.requester_name),
          companyName: bolagsnamn,
          companySlug: recipient.companies?.slug,
          message: svarsmeddelande,
          searchRole: recipient.inquiries?.search_role,
          city: recipient.inquiries?.city,
        })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true });
}
