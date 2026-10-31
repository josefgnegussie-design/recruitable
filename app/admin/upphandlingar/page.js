import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import UpphandlingKo from "@/components/admin/UpphandlingKo";

// Ingen upphandling syns för någon förrän den godkänts här.
export default async function AdminUpphandlingarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const { data, error } = await createAdminClient()
    .from("procurements")
    .select(
      "id, created_at, title, description, service, buyer_type, buyer_description, name_visibility, cities, competences, " +
        "focus_areas, interest_deadline, requester_name, requester_email, requester_role, requester_company, requester_website"
    )
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div style={{ maxWidth: 820, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1 className="admin-h1" style={{ marginBottom: 8 }}>Granska upphandlingar</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 32 }}>
        Godkännandet publicerar upphandlingen och mejlar bolag som tagit över sin profil och har ett matchande
        yrkesområde. Kontrollera att köparens namn inte står i beskrivningen när namnet ska vara dolt.
      </p>
      {error ? (
        <p>Upphandlingarna kunde inte läsas. Är supabase/migration_upphandling.sql körd?</p>
      ) : (
        <UpphandlingKo initialKo={data || []} />
      )}
    </div>
  );
}
