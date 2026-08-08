import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import { INQUIRIES_PAGE_SIZE, mapInquiryRow } from "@/lib/inquiries";

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

  // Hämtar bara den första sidan (senaste INQUIRIES_PAGE_SIZE) — fler sidor
  // laddas vid behov via /api/mina-sidor/forfragan-lista. Annars skulle ett
  // bolag med många förfrågningar över tid göra sidan tyngre och tyngre.
  const { data: inquiryRows } = await supabase
    .from("inquiry_recipients")
    .select("id, created_at, status, inquiries(*)")
    .eq("company_id", adminRow.company_id)
    .order("created_at", { ascending: false })
    .limit(INQUIRIES_PAGE_SIZE + 1);

  const rows = inquiryRows || [];
  const hasMore = rows.length > INQUIRIES_PAGE_SIZE;
  const inquiries = rows
    .slice(0, INQUIRIES_PAGE_SIZE)
    .filter((row) => row.inquiries)
    .map(mapInquiryRow);

  // Övriga administratörer för samma bolag — auth.users är bara läsbart via
  // service role-klienten, så vi slår upp e-postadresserna separat här.
  const admin = createAdminClient();
  const { data: adminRows } = await admin
    .from("company_admins")
    .select("id, user_id")
    .eq("company_id", adminRow.company_id)
    .order("created_at", { ascending: true });

  const teamMembers = await Promise.all(
    (adminRows || []).map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return { id: row.id, email: data?.user?.email || "(okänt konto)", isSelf: row.user_id === user.id };
    })
  );

  return (
    <MinaSidorTabs company={company} inquiries={inquiries} hasMore={hasMore} teamMembers={teamMembers} />
  );
}
