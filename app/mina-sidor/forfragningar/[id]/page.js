import { notFound } from "next/navigation";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import InquiriesList from "@/components/admin/InquiriesList";
import { hamtaBolagskonto, hamtaFlikraknare, hamtaForfragan, hamtaForfragningar } from "@/lib/minaSidor";

// En enskild förfrågan, dit mejlet till bolaget länkar. Visas i den vanliga
// listan, framscrollad och markerad, så att bolaget kan svara direkt och ändå
// se resten.
export default async function ForfraganPage({ params }) {
  const { id } = await params;

  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} />;

  const companyId = konto.adminRow.company_id;
  const [forfragan, raknare, { inquiries, hasMore }] = await Promise.all([
    // Hämtas med bolagets id som villkor: en förfrågan som hör till ett annat
    // bolag ger samma 404 som en som inte finns.
    hamtaForfragan(companyId, id),
    hamtaFlikraknare(konto.supabase, companyId),
    hamtaForfragningar(companyId),
  ]);

  if (!forfragan) notFound();

  // Ligger förfrågan utanför första sidan — den är äldre än de senaste
  // förfrågningarna — läggs den till i listan på sin plats efter datum.
  const lista = inquiries.some((inq) => inq.recipientId === forfragan.recipientId)
    ? inquiries
    : [...inquiries, forfragan].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <MinaSidorTabs {...raknare}>
      <InquiriesList inquiries={lista} initialHasMore={hasMore} markeradId={forfragan.recipientId} />
    </MinaSidorTabs>
  );
}
