import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";

export default async function MinaSidorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
        <p>Vi hittar ingen bolagskoppling för det här kontot. Kontakta info@recruitable.se.</p>
      </div>
    );
  }

  if (!adminRow.verified) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
        <p>Ert konto väntar fortfarande på godkännande. Vi hör av oss så snart det är klart.</p>
      </div>
    );
  }

  if (!adminRow.company_id) {
    return (
      <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
        <p>Ert konto är godkänt men ännu inte kopplat till ett bolag. Kontakta info@recruitable.se.</p>
      </div>
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, is_premium, extended_vision, mission, history, expertise, cover_image, logo, team_members, surveys")
    .eq("id", adminRow.company_id)
    .single();

  const { data: inquiryRows } = await supabase
    .from("inquiry_recipients")
    .select("id, created_at, status, inquiries(*)")
    .eq("company_id", adminRow.company_id)
    .order("created_at", { ascending: false });

  const inquiries = (inquiryRows || [])
    .filter((row) => row.inquiries)
    .map((row) => ({ recipientId: row.id, receivedAt: row.created_at, status: row.status, ...row.inquiries }));

  return <MinaSidorTabs company={company} inquiries={inquiries} />;
}
