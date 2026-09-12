import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import KontoansokanKo from "@/components/admin/KontoansokanKo";

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
    .select("id, created_at, user_id, claimed_company_name, claimed_org_number, claimed_address, claimed_website, claimed_focus_areas, claimed_services")
    .eq("verified", false)
    .is("company_id", null)
    .order("created_at", { ascending: true });

  // Ansökans org.nummer matchas mot registret, så att den vanliga vägen blir ett
  // klick: bolaget finns oftast redan bland de dryga tretusen importerade.
  const orgnummer = (ansokningar ?? [])
    .map((a) => (a.claimed_org_number || "").replace(/\D/g, ""))
    .filter((n) => n.length === 10)
    .map((n) => `${n.slice(0, 6)}-${n.slice(6)}`);

  let traffar = [];
  if (orgnummer.length) {
    const { data } = await admin
      .from("companies")
      .select("id, name, org_number, city")
      .in("org_number", orgnummer);
    traffar = data ?? [];
  }

  const perOrgnr = Object.fromEntries(traffar.map((b) => [b.org_number, b]));

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

    // Registreringen kräver att mejldomänen matchar den uppgivna webbplatsen.
    // Kontrollen görs om här och visas, så att granskaren ser grunden för
    // beslutet i stället för att lita på att den gjordes vid registreringen.
    const webbdoman = (a.claimed_website || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
    const epostdoman = (epost || "").split("@")[1]?.toLowerCase() || null;

    return {
      ...a,
      foreslaget: nyckel ? perOrgnr[nyckel] ?? null : null,
      epost,
      epostBekraftad: Boolean(konto?.email_confirmed_at),
      domanMatchar: Boolean(epostdoman && webbdoman && epostdoman === webbdoman),
    };
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div className="eyebrow">Intern granskning</div>
      <h1 className="hero-title" style={{ fontSize: 34, marginBottom: 8 }}>Kontoansökningar</h1>
      <p className="hero-sub" style={{ marginBottom: 28 }}>
        Bolag som ansökt om att ta över sin profil. Ett godkännande kopplar dem till rätt bolag i
        registret och släpper in dem på Mina sidor.
      </p>
      <KontoansokanKo ansokningar={berikade} />
    </div>
  );
}
