import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import Kontoflik from "@/components/admin/Kontoflik";
import Sammanslagning from "@/components/admin/Sammanslagning";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaAdministratorer } from "@/lib/bolagsadmin";
import { hamtaInbjudningar } from "@/lib/inbjudningar";
import { hamtaArenden } from "@/lib/sammanslagning";
import { hamtaBolagskonto, hamtaFlikraknare } from "@/lib/minaSidor";

export default async function KontoPage() {
  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} />;

  const { supabase, adminRow } = konto;
  const arAgare = Boolean(adminRow.ar_agare);
  const [raknare, administratorer, inbjudningar, arenden, { data: company }] = await Promise.all([
    hamtaFlikraknare(supabase, adminRow.company_id),
    // Administratörerna hämtas här och inte i kontofliken: mejladresserna bor i
    // auth.users och kräver servicerollen, och listan är färdig innan sidan
    // renderas i stället för efter.
    hamtaAdministratorer(createAdminClient(), adminRow.company_id),
    // Bara ägaren kan bjuda in och återkalla, så bara ägaren ser listan.
    arAgare ? hamtaInbjudningar(createAdminClient(), adminRow.company_id) : [],
    // Sammanslagningsärendena läses med besökarens egen session. RLS-policyn i
    // migration_sammanslagning.sql släpper bara igenom ärenden där bolaget är den
    // ena parten, så servicerollen behövs inte.
    hamtaArenden(supabase, adminRow.company_id),
    supabase.from("companies").select("name").eq("id", adminRow.company_id).single(),
  ]);

  // Sammanslagningen ligger i Konto-fliken och inte i Profil: den handlar
  // inte om vad profilen innehåller utan om huruvida bolaget ska finnas kvar
  // som ett eget kort — samma nivå som ägarskapet och administratörerna.
  return (
    <MinaSidorTabs {...raknare}>
      <Kontoflik administratorer={administratorer} inbjudningar={inbjudningar} duArAgare={arAgare} />
      <Sammanslagning arenden={arenden || []} duArAgare={arAgare} bolagsnamn={company?.name || ""} />
    </MinaSidorTabs>
  );
}
