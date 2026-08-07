import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import ModerationQueue from "@/components/admin/ModerationQueue";

// Recruitables egen interna granskningskö — inte synlig eller länkad någon-
// stans i det publika gränssnittet. Ingen förfrågan syns för något bolag,
// inte ens i redigerad form, förrän den godkänts här. Låter oss verifiera
// att avsändaren är seriös och att rätt bolag valts innan de informeras.
export default async function ModereraForfragningarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("inquiries")
    .select(
      "id, created_at, description, search_role, focus_area, service, requester_name, requester_email, requester_role, requester_company, requester_website, requester_city, requester_phone, inquiry_recipients(companies(name))"
    )
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true });

  const queue = (rows || []).map((row) => ({
    inquiryId: row.id,
    createdAt: row.created_at,
    description: row.description,
    searchRole: row.search_role,
    focusArea: row.focus_area,
    service: row.service,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterRole: row.requester_role,
    requesterCompany: row.requester_company,
    requesterWebsite: row.requester_website,
    requesterCity: row.requester_city,
    requesterPhone: row.requester_phone,
    companies: (row.inquiry_recipients || []).map((r) => r.companies?.name).filter(Boolean),
  }));

  return (
    <div style={{ maxWidth: 820, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Godkänn nya förfrågningar</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 32 }}>
        Ingen förfrågan syns för de valda bolagen förrän du godkänner den här — varken förfrågan själv eller att
        den existerar.
      </p>
      <ModerationQueue initialQueue={queue} />
    </div>
  );
}
