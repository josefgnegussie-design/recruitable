import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import ModerationQueue from "@/components/admin/ModerationQueue";

function dagarSedan(dagar) {
  return new Date(Date.now() - dagar * 24 * 3600 * 1000).toISOString();
}

// Recruitables egen interna granskningskö — inte synlig eller länkad någon-
// stans i det publika gränssnittet. De flesta förfrågningar godkänns
// automatiskt (lib/automatiskGranskning.js). Hit kommer de som fastnat i en
// kontroll, och här kan något som redan gått ut dras tillbaka.
export default async function ModereraForfragningarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();
  const KOLUMNER =
    "id, created_at, description, search_role, focus_area, service, requester_name, requester_email, requester_role, requester_company, requester_website, requester_city, requester_phone, inquiry_recipients(companies(name))";
  const NYA = ", granskningsorsaker, bekraftad_at, moderated_at, moderated_by, upphandling";

  // Kön först med orsakerna. Saknas kolumnerna har migrationen
  // migration_automatisk_granskning.sql inte körts: då visas kön som förut i
  // stället för att se tom ut.
  let { data: rows, error } = await admin
    .from("inquiries")
    .select(KOLUMNER + NYA)
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true });
  const migrerad = !error;
  if (error) {
    console.error("Granskningskön utan orsaker — kör supabase/migration_automatisk_granskning.sql.", JSON.stringify(error));
    ({ data: rows } = await admin
      .from("inquiries")
      .select(KOLUMNER)
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true }));
  }

  // Det som gått ut de senaste två veckorna, så att något som slunkit igenom
  // kan dras tillbaka i efterhand.
  const sedan = dagarSedan(14);
  const [{ data: godkanda }, { count: obekraftade }] = migrerad
    ? await Promise.all([
        admin
          .from("inquiries")
          .select(KOLUMNER + NYA)
          .eq("moderation_status", "approved")
          .gte("moderated_at", sedan)
          .order("moderated_at", { ascending: false }),
        admin.from("inquiries").select("id", { count: "exact", head: true }).eq("moderation_status", "unconfirmed"),
      ])
    : [{ data: [] }, { count: 0 }];

  const tillKort = (row) => ({
    inquiryId: row.id,
    createdAt: row.created_at,
    moderatedAt: row.moderated_at || null,
    automatiskt: row.moderated_by === "auto",
    upphandling: Boolean(row.upphandling),
    orsaker: row.granskningsorsaker || [],
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
  });

  return (
    <div style={{ maxWidth: 820, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Granska förfrågningar</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 32 }}>
        Förfrågningar och upphandlingar godkänns automatiskt när avsändaren bekräftat sin adress och inget sticker ut.
        Hit kommer bara de som fastnat i en kontroll. Inget syns för bolagen förrän du godkänner dem.
        {obekraftade ? ` ${obekraftade} väntar fortfarande på att avsändaren bekräftar.` : ""}
      </p>
      <ModerationQueue initialQueue={(rows || []).map(tillKort)} initialGodkanda={(godkanda || []).map(tillKort)} />
    </div>
  );
}
