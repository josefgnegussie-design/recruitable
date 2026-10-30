import { notFound } from "next/navigation";
import Link from "next/link";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import Intresseanmalan from "@/components/upphandling/Intresseanmalan";
import { UpphandlingBeskrivning, UpphandlingFakta, UpphandlingTidplan } from "@/components/upphandling/UpphandlingInnehall";
import { hamtaBolagskonto, hamtaFlikraknare } from "@/lib/minaSidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaForLeverantor } from "@/lib/upphandlingRepo";
import { idag } from "@/lib/upphandling";

export const metadata = { robots: { index: false, follow: false } };

export default async function LeverantorUpphandlingPage({ params }) {
  const { id } = await params;
  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} adminRow={konto.adminRow} />;

  const { supabase, adminRow } = konto;
  const [raknare, vy] = await Promise.all([
    hamtaFlikraknare(supabase, adminRow.company_id),
    hamtaForLeverantor(createAdminClient(), id, adminRow.company_id),
  ]);
  if (!vy) notFound();

  const { upphandling: u, krav, anmalan, bolag } = vy;

  return (
    <MinaSidorTabs {...raknare}>
      <div className="upp-staplad">
        <Link href="/mina-sidor/upphandling" style={{ fontSize: 13 }}>&larr; Alla upphandlingar</Link>
        <header>
          <h1 className="upp-rubrik">{u.title}</h1>
          <p className="upp-brod">
            {u.kopare_namn || `${u.buyer_description}. Köparens namn visas när ni har anmält intresse.`}
          </p>
        </header>
        <UpphandlingBeskrivning u={u} />
        <UpphandlingTidplan u={u} />
        <UpphandlingFakta u={u} />
        <Intresseanmalan
          u={u}
          krav={krav}
          anmalan={anmalan}
          bolagsnamn={bolag?.namn || ""}
          fragorOppna={u.oppen && u.questions_deadline >= idag()}
        />
      </div>
    </MinaSidorTabs>
  );
}
