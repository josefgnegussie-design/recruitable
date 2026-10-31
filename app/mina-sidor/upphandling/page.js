import Link from "next/link";
import MinaSidorTabs from "@/components/admin/MinaSidorTabs";
import MinaSidorStatus from "@/components/admin/MinaSidorStatus";
import UpphandlingKort from "@/components/upphandling/UpphandlingKort";
import { hamtaBolagskonto, hamtaFlikraknare } from "@/lib/minaSidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaUpphandlingarForBolag } from "@/lib/upphandlingRepo";
import { datumText } from "@/lib/upphandling";

export const metadata = { title: "Upphandlingar — Mina sidor" };

function statusText(a) {
  if (a.vidare) return "Går vidare";
  if (a.avslutad) return "Avslutad";
  return `Anmäld, sista dag ${datumText(a.sista)}`;
}

export default async function UpphandlingFlikPage() {
  const konto = await hamtaBolagskonto();
  if (konto.tillstand) return <MinaSidorStatus tillstand={konto.tillstand} adminRow={konto.adminRow} />;

  const { supabase, adminRow } = konto;
  const [raknare, { oppna, anmalda, otillganglig }] = await Promise.all([
    hamtaFlikraknare(supabase, adminRow.company_id),
    hamtaUpphandlingarForBolag(createAdminClient(), adminRow.company_id),
  ]);

  return (
    <MinaSidorTabs {...raknare}>
      {anmalda.length > 0 && (
        <section style={{ margin: "24px 0" }}>
          <h2 className="upp-rubrik">Era anmälningar</h2>
          <ul className="uppfoljning-lista">
            {anmalda.map((a) => (
              <li className="auth-panel" key={a.id}>
                <div className="uppfoljning-rad">
                  <Link href={`/mina-sidor/upphandling/${a.id}`} style={{ fontWeight: 600 }}>{a.titel}</Link>
                  <span className={`status-pill${a.vidare ? " accepted" : ""}`}>{statusText(a)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ margin: "24px 0" }}>
        <h2 className="upp-rubrik">Öppna upphandlingar</h2>
        {otillganglig ? (
          <p>Upphandlingarna går inte att visa just nu. Försök igen om en stund.</p>
        ) : oppna.length === 0 ? (
          <p>Det finns inga öppna upphandlingar att anmäla sig till just nu. Ni får ett mejl när en ny matchar er profil.</p>
        ) : (
          <div className="grid" style={{ marginTop: 14 }}>
            {oppna.map((u) => (
              <UpphandlingKort u={u} key={u.id} matchar={u.matchar} href={`/mina-sidor/upphandling/${u.id}`} />
            ))}
          </div>
        )}
      </section>
    </MinaSidorTabs>
  );
}
