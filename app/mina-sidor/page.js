import { redirect } from "next/navigation";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import InquiriesList from "@/components/admin/InquiriesList";
import MinaSidorOversikt from "@/components/admin/MinaSidorOversikt";
import { hamtaBolagskonto, hamtaFlikraknare, hamtaForfragningar, hamtaOversikt } from "@/lib/minaSidor";

export const metadata = { title: "Förfrågningar — Mina sidor" };

const STRIPE_UTFALL = new Set(["klart", "avbrutet"]);

// Förfrågningsfliken. Övriga flikar har egna sidor under /mina-sidor/.
export default async function MinaSidorPage({ searchParams }) {
  const params = await searchParams;

  // Stripe skickade tidigare tillbaka hit med ?premium= och ?kontor=, och
  // betalningar som påbörjades före bytet till egna flikadresser kommer
  // fortfarande den vägen. Beskedet hör hemma på fliken betalningen gällde.
  if (STRIPE_UTFALL.has(params?.premium)) redirect(`/mina-sidor/profil?premium=${params.premium}`);
  if (STRIPE_UTFALL.has(params?.kontor)) redirect(`/mina-sidor/kontor?kontor=${params.kontor}`);

  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} adminRow={konto.adminRow} />;

  const companyId = konto.adminRow.company_id;
  const [raknare, { inquiries, hasMore }, oversikt] = await Promise.all([
    hamtaFlikraknare(konto.supabase, companyId),
    hamtaForfragningar(companyId),
    hamtaOversikt(companyId),
  ]);

  return (
    <MinaSidorTabs {...raknare}>
      <MinaSidorOversikt {...oversikt} />
      <InquiriesList inquiries={inquiries} initialHasMore={hasMore} />
    </MinaSidorTabs>
  );
}
