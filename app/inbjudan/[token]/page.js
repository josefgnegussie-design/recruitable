import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { hittaAnvandare } from "@/lib/bolagsadmin";
import { hamtaOppenInbjudan } from "@/lib/inbjudningar";
import InbjudanForm from "@/components/admin/InbjudanForm";

// Länken i inbjudningsmejlet är personlig och ska inte hamna i ett sökindex.
export const metadata = {
  title: "Recruitable — Inbjudan",
  robots: { index: false, follow: false },
};

export default async function InbjudanPage({ params }) {
  const { token } = await params;
  const admin = createAdminClient();
  const inbjudan = await hamtaOppenInbjudan(admin, token);

  // Vem som har ett konto avslöjas bara för den som har länken, och den gick ut
  // till just den adressen. Utan svaret skulle sidan be en befintlig användare
  // välja ett lösenord som sedan inte används.
  const harKonto = inbjudan ? Boolean(await hittaAnvandare(admin, inbjudan.epost)) : false;

  return (
    <div id="view-inbjudan">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">Inbjudan</div>
          <h1 className="hero-title">
            {inbjudan ? `Gå med i ${inbjudan.companies?.name || "bolagets konto"}` : "Inbjudan gäller inte längre"}
          </h1>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        {inbjudan ? (
          <InbjudanForm token={token} epost={inbjudan.epost} harKonto={harKonto} />
        ) : (
          <div className="auth-panel">
            <p>
              Länken har redan använts, återkallats eller gått ut. Be den som bjöd in dig skicka en ny inbjudan,
              eller <Link href="/logga-in">logga in</Link> om du redan gått med.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
