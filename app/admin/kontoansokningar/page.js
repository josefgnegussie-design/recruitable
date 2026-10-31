import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import KontoansokanKo from "@/components/admin/KontoansokanKo";
import { domanMatchar } from "@/lib/overtagande";

export const dynamic = "force-dynamic";

// Recruitables egen kö för kontoansökningar — inte länkad någonstans i det
// publika gränssnittet. Ingen bolagsadmin kommer åt sin profil förrän ansökan
// godkänts här.
export default async function KontoansokningarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();

  const { data: ansokningar } = await admin
    .from("company_admins")
    .select("id, created_at, user_id, full_name, claimed_company_id, claimed_company_name, claimed_org_number, claimed_address, claimed_website, claimed_focus_areas, claimed_services")
    .eq("verified", false)
    .eq("auto_godkann", false)
    .is("company_id", null)
    .order("created_at", { ascending: true });

  // Går igenom utan granskning, men ska synas: det som väntar på att någon
  // bekräftar sitt mejl, och det som nyligen aktiverats och kan behöva ångras.
  const { data: vantande } = await admin
    .from("company_admins")
    .select("id, created_at, full_name, claimed_company_name")
    .eq("verified", false)
    .eq("auto_godkann", true)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: automatiskaRader } = await admin
    .from("company_admins")
    .select("id, user_id, godkand_at, full_name, companies(name, slug)")
    .eq("godkand_av", "automatiskt")
    .order("godkand_at", { ascending: false })
    .limit(20);

  const automatiska = await Promise.all(
    (automatiskaRader ?? []).map(async (r) => {
      const { data } = await admin.auth.admin.getUserById(r.user_id);
      return { ...r, epost: data?.user?.email ?? null };
    })
  );

  // Ansökans bolag är känt när det valdes ur registret. Annars matchas
  // org.numret, så att den vanliga vägen blir ett klick: bolaget finns oftast
  // redan bland de dryga tretusen importerade.
  const orgnummer = (ansokningar ?? [])
    .map((a) => (a.claimed_org_number || "").replace(/\D/g, ""))
    .filter((n) => n.length === 10)
    .map((n) => `${n.slice(0, 6)}-${n.slice(6)}`);
  const bolagsIdn = (ansokningar ?? []).map((a) => a.claimed_company_id).filter(Boolean);

  let traffar = [];
  if (orgnummer.length) {
    const { data } = await admin
      .from("companies")
      .select("id, name, org_number, city, link, claimed")
      .in("org_number", orgnummer);
    traffar = data ?? [];
  }
  if (bolagsIdn.length) {
    const { data } = await admin
      .from("companies")
      .select("id, name, org_number, city, link, claimed")
      .in("id", bolagsIdn);
    traffar = [...traffar, ...(data ?? [])];
  }

  const perOrgnr = Object.fromEntries(traffar.map((b) => [b.org_number, b]));
  const perId = Object.fromEntries(traffar.map((b) => [b.id, b]));

  // Vem som ansökt. Mejladressen bor i auth.users och inte i company_admins, så
  // kön visade tidigare bara bolagsuppgifterna — granskaren kunde godkänna att
  // någon får kontrollen över en profil utan att se vem det var. Kön är alltid
  // kort, så ett uppslag per rad kostar ingenting.
  const konton = await Promise.all(
    (ansokningar ?? []).map(async (a) => {
      const { data } = await admin.auth.admin.getUserById(a.user_id);
      return [a.id, data?.user ?? null];
    })
  );
  const perAnsokan = Object.fromEntries(konton);

  const berikade = (ansokningar ?? []).map((a) => {
    const siffror = (a.claimed_org_number || "").replace(/\D/g, "");
    const nyckel = siffror.length === 10 ? `${siffror.slice(0, 6)}-${siffror.slice(6)}` : null;
    const konto = perAnsokan[a.id];
    const epost = konto?.email ?? null;

    const foreslaget = perId[a.claimed_company_id] ?? (nyckel ? perOrgnr[nyckel] ?? null : null);

    // Mot webbplatsen i registret, inte den sökande själv uppgett: en uppgift
    // från den som ansöker bevisar ingenting. Saknas bolaget i registret finns
    // bara den uppgivna adressen att jämföra med, vilket kön talar om.
    return {
      ...a,
      foreslaget,
      epost,
      epostBekraftad: Boolean(konto?.email_confirmed_at),
      registretsWebbplats: foreslaget?.link ?? null,
      domanMatchar: domanMatchar(epost, foreslaget?.link ?? a.claimed_website),
    };
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div className="eyebrow">Intern granskning</div>
      <h1 className="hero-title" style={{ fontSize: 34, marginBottom: 8 }}>Kontoansökningar</h1>
      <p className="hero-sub" style={{ marginBottom: 28 }}>
        Den som har en adress på bolagets domän blir administratör direkt och syns under Automatiska
        övertaganden. Hit kommer bara de ansökningar som behöver en människa.
      </p>
      <KontoansokanKo ansokningar={berikade} automatiska={automatiska} vantande={vantande ?? []} />
    </div>
  );
}
