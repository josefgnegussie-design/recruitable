import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaPublikUpphandling } from "@/lib/upphandlingRepo";
import { UpphandlingBeskrivning, UpphandlingFakta, UpphandlingFragor, UpphandlingTidplan } from "@/components/upphandling/UpphandlingInnehall";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const u = await hamtaPublikUpphandling(createAdminClient(), id);
  return { title: u ? `${u.title} — Upphandling — Recruitable` : "Upphandling — Recruitable" };
}

export default async function UpphandlingDetaljPage({ params }) {
  const { id } = await params;
  const u = await hamtaPublikUpphandling(createAdminClient(), id);

  // Ogranskad, nekad och påhittad adress ger samma svar.
  if (!u) notFound();

  return (
    <div id="view-upphandling">
      <Link className="back-link" href="/upphandling">&larr; Alla upphandlingar</Link>
      <div className="upp-sida">
        <header className="upp-huvud">
          <h1 className="hero-title">{u.title}</h1>
          <p className="hero-sub">
            {u.kopare_namn || `${u.buyer_description}. Köparens namn visas när ni har anmält intresse.`}
          </p>
        </header>

        <div className="upp-kolumner">
          <main>
            <UpphandlingBeskrivning u={u} />
            <UpphandlingFragor fragor={u.fragor} />
          </main>
          <aside>
            <section className="auth-panel">
              {u.oppen ? (
                <>
                  <h2 className="upp-rubrik-liten">Kan ni leverera?</h2>
                  <p className="upp-brod">Anmäl vad ni kan leverera. Det räcker med en del av uppdraget.</p>
                  <Link className="qs-btn upp-lank-knapp" href={`/mina-sidor/upphandling/${u.id}`}>
                    Anmäl intresse
                  </Link>
                  <p className="upp-not">
                    Kräver ett bolagskonto. <Link href="/for-bolag/registrera">Registrera ert bolag</Link>.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="upp-rubrik-liten">Upphandlingen är stängd</h2>
                  <p className="upp-brod">Det går inte längre att anmäla intresse.</p>
                </>
              )}
            </section>
            <UpphandlingTidplan u={u} />
            <UpphandlingFakta u={u} />
            <section className="auth-panel upp-sekretess">
              <h2 className="upp-rubrik-liten">Sekretess</h2>
              <p className="upp-brod">Andra leverantörer ser aldrig att ni har anmält intresse.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
