import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import OfficesManager from "@/components/admin/OfficesManager";
import { hamtaBolagskonto, hamtaFlikraknare } from "@/lib/minaSidor";

export default async function KontorPage({ searchParams }) {
  const params = await searchParams;

  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} />;

  const { supabase, adminRow } = konto;
  const [raknare, { data: officeRows }] = await Promise.all([
    hamtaFlikraknare(supabase, adminRow.company_id),
    supabase
      .from("offices")
      .select("id, city, address, contact_name, contact_email, is_headquarters, paid, created_at")
      .eq("company_id", adminRow.company_id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <MinaSidorTabs {...raknare} officeStatus={params?.kontor}>
      <OfficesManager offices={officeRows || []} />
    </MinaSidorTabs>
  );
}
