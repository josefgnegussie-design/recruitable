import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import ProfilEditor from "@/components/admin/ProfilEditor";
import PremiumManageButton from "@/components/admin/PremiumManageButton";
import { hamtaBolagskonto, hamtaFlikraknare } from "@/lib/minaSidor";

export default async function ProfilPage({ searchParams }) {
  const params = await searchParams;

  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} />;

  const { supabase, adminRow } = konto;
  const [raknare, { data: company }] = await Promise.all([
    hamtaFlikraknare(supabase, adminRow.company_id),
    supabase
      .from("companies")
      .select(
        "id, name, is_premium, vision, description, focus, services, recruiting_roles, link, contact, " +
          "ka, iso_certifications, slideshow, addresses, logo, surveys, company_key_figures, " +
          // Nyckeltalen är bolagets egna sedan migration_nyckeltal.sql.
          "revenue, revenue_year, employees, employees_year, founded"
      )
      .eq("id", adminRow.company_id)
      .single(),
  ]);

  // Hela profilen redigeras av alla verifierade bolag. Fälten är precis det
  // en kund väljer leverantör utifrån, så en betalvägg här gör registret
  // sämre för den sida som flödet börjar hos. Prenumerationen ska i stället
  // knytas till förfrågningarna — knappen nedan finns kvar så länge, så att
  // de som redan betalar kan se och avsluta sin prenumeration.
  return (
    <MinaSidorTabs {...raknare} premiumStatus={params?.premium}>
      <ProfilEditor company={company} />
      {/* Prenumerationen är ägarens ansvar — knappen leder till Stripes
          portal, där den som kommer in kan säga upp abonnemanget. */}
      {company?.is_premium && adminRow.ar_agare && <PremiumManageButton />}
    </MinaSidorTabs>
  );
}
