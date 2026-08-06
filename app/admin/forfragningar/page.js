import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import ReleaseQueue from "@/components/admin/ReleaseQueue";

// Recruitables egen interna granskningskö — inte synlig eller länkad någon-
// stans i det publika gränssnittet. Listar förfrågningar ett bolag redan
// accepterat men där kontaktuppgifterna ännu inte släppts till dem.
export default async function AdminForfragningarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("inquiry_recipients")
    .select("id, created_at, companies(name), inquiries(requester_name, requester_company, requester_city, description)")
    .eq("status", "accepted")
    .is("released_at", null)
    .order("created_at", { ascending: true });

  const queue = (rows || [])
    .filter((row) => row.inquiries && row.companies)
    .map((row) => ({
      recipientId: row.id,
      acceptedCompany: row.companies.name,
      requesterName: row.inquiries.requester_name,
      requesterCompany: row.inquiries.requester_company,
      requesterCity: row.inquiries.requester_city,
      description: row.inquiries.description,
      createdAt: row.created_at,
    }));

  return (
    <div style={{ maxWidth: 820, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Granska och släpp kontaktuppgifter</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 32 }}>
        Dessa bolag har accepterat en förfrågan. Kontaktuppgifterna syns inte för bolaget förrän du släpper dem här.
      </p>
      <ReleaseQueue initialQueue={queue} />
    </div>
  );
}
