import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import { INQUIRIES_PAGE_SIZE, mapInquiryRow } from "@/lib/inquiries";

export default async function MinaSidorPage({ searchParams }) {
  const params = await searchParams;
  const premiumStatus = params?.premium;
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

  return <MinaSidorTabs company={company} inquiries={inquiries} hasMore={hasMore} premiumStatus={premiumStatus} />;
}
