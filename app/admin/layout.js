import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import AdminNav from "@/components/admin/AdminNav";
import LoggaUtKnapp from "@/components/admin/LoggaUtKnapp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recruitable — internt",
  robots: { index: false, follow: false },
};

// Gemensamt skal för Recruitables interna sidor. Spärren här är ett extra
// lager, inte det enda: varje sida gör om samma kontroll själv, eftersom en
// layout i Next inte körs om vid varje navigering och därför aldrig ensam
// får bära behörigheten.
export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();
  const [forfragningar, ansokningar] = await Promise.all([
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("moderation_status", "pending"),
    admin
      .from("company_admins")
      .select("id", { count: "exact", head: true })
      .eq("verified", false)
      .is("company_id", null),
  ]);

  return (
    <div className="admin-shell">
      <div className="admin-topp">
        <div>
          <div className="eyebrow">
            Internt · {user.email} · <LoggaUtKnapp />
          </div>
          <p className="admin-topp-titel">Recruitable</p>
        </div>
        <AdminNav
          koer={{
            forfragningar: forfragningar.count ?? 0,
            ansokningar: ansokningar.count ?? 0,
          }}
        />
      </div>
      {children}
    </div>
  );
}
