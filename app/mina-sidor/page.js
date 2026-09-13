import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import { INQUIRIES_PAGE_SIZE, mapInquiryRow } from "@/lib/inquiries";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaAdministratorer } from "@/lib/bolagsadmin";
import { hamtaArenden } from "@/lib/sammanslagning";

export default async function MinaSidorPage({ searchParams }) {
  const params = await searchParams;
  const premiumStatus = params?.premium;
  const officeStatus = params?.kontor;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");

  // Recruitables egna konton har inget bolag att administrera och landade
  // förut på "Vi hittar ingen bolagskoppling för det här kontot". Inloggningen
  // skickar alla hit, så omdirigeringen hör hemma här och inte i formuläret —
  // då gäller den oavsett vilken väg man kom in.
  if (isPlatformAdmin(user.email)) redirect("/admin");

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified, ar_agare")
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
    .select("id, name, is_premium, vision, description, focus, services, recruiting_roles, link, contact, ka, slideshow, addresses, logo, surveys")
    .eq("id", adminRow.company_id)
    .single();

  const { data: officeRows } = await supabase
    .from("offices")
    .select("id, city, address, contact_name, contact_email, is_headquarters, paid, created_at")
    .eq("company_id", adminRow.company_id)
    .order("created_at", { ascending: true });

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

  // Administratörerna hämtas här och inte i kontofliken: mejladresserna bor i
  // auth.users och kräver servicerollen, och listan är färdig innan sidan
  // renderas i stället för efter.
  const administratorer = await hamtaAdministratorer(createAdminClient(), adminRow.company_id);

  // Sammanslagningsärendena läses med besökarens egen session. RLS-policyn i
  // migration_sammanslagning.sql släpper bara igenom ärenden där bolaget är den
  // ena parten, så servicerollen behövs inte.
  const arenden = await hamtaArenden(supabase, adminRow.company_id);

  return (
    <MinaSidorTabs
      company={company}
      inquiries={inquiries}
      hasMore={hasMore}
      premiumStatus={premiumStatus}
      offices={officeRows || []}
      officeStatus={officeStatus}
      arAgare={Boolean(adminRow.ar_agare)}
      administratorer={administratorer}
      arenden={arenden}
    />
  );
}
