import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { hamtaStatistik, senasteManader, tolkaManad } from "@/lib/statistik";
import { MigrationSaknas, Nyckeltal, Utfallsstapel, tal } from "@/components/admin/Statistikvy";

export const dynamic = "force-dynamic";

// Underlaget för faktureringen: vad varje bolag fick, och vad de gjorde med
// det, månad för månad. Ingen prislogik här — antalen är facit, priset sätter
// du när du fakturerar. Ett pris i koden hade behövt hållas i synk med
// avtalen, och den synken finns det inget som bevakar.
export default async function FaktureringPage({ searchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const manad = tolkaManad(params?.manad);
  const manader = senasteManader(12);

  const [underlag, summering] = await Promise.all([
    hamtaStatistik("statistik_underlag_per_bolag", { p_fran: manad.fran, p_till: manad.till }),
    hamtaStatistik("statistik_forfragningar", { p_fran: manad.fran, p_till: manad.till }),
  ]);

  const rader = underlag.data || [];
  const f = summering.data?.[0] || {};

  const totalt = rader.reduce(
    (s, r) => ({
      utskick: s.utskick + Number(r.utskick || 0),
      accepterade: s.accepterade + Number(r.accepterade || 0),
      nekade: s.nekade + Number(r.nekade || 0),
      obesvarade: s.obesvarade + Number(r.obesvarade || 0),
    }),
    { utskick: 0, accepterade: 0, nekade: 0, obesvarade: 0 }
  );

  return (
    <div className="admin-sida">
      <div className="admin-rubrikrad">
        <div>
          <h1 className="admin-h1">Faktureringsunderlag</h1>
          <p className="admin-ingress">
            {manad.etikett} — {tal(rader.length)} bolag fick minst en förfrågan.
          </p>
        </div>
        <div className="periodval">
          <form method="get">
            <select name="manad" defaultValue={manad.nyckel} className="manadsval">
              {manader.map((m) => (
                <option key={m.nyckel} value={m.nyckel}>
                  {m.etikett}
                </option>
              ))}
            </select>
            <button type="submit" className="status-btn">
              Visa
            </button>
          </form>
        </div>
      </div>

      {underlag.saknasMigration && <MigrationSaknas fil="supabase/migration_statistik.sql" />}

      <section className="admin-block">
        <Nyckeltal
          poster={[
            { etikett: "Utskick till bolag", varde: tal(totalt.utskick) },
            { etikett: "Accepterade", varde: tal(totalt.accepterade) },
            { etikett: "Nekade", varde: tal(totalt.nekade) },
            {
              etikett: "Obesvarade",
              varde: tal(totalt.obesvarade),
              hjalp:
                f.median_svarstid_timmar != null
                  ? `Median svarstid ${Number(f.median_svarstid_timmar)} h.`
                  : undefined,
            },
          ]}
        />

        <div className="admin-panel">
          <Utfallsstapel
            accepterade={totalt.accepterade}
            nekade={totalt.nekade}
            obesvarade={totalt.obesvarade}
          />
        </div>

        <div className="admin-panel">
          <div className="admin-panelrad">
            <h3 className="admin-h3">Per bolag</h3>
            <a className="link-btn" href={`/api/admin/fakturering/export?manad=${manad.nyckel}`}>
              Hämta som CSV
            </a>
          </div>

          {rader.length === 0 ? (
            <p className="tomt">Inga godkända förfrågningar nådde något bolag den här månaden.</p>
          ) : (
            <div className="tabellrullning">
              <table className="admin-tabell">
                <thead>
                  <tr>
                    <th>Bolag</th>
                    <th>Ort</th>
                    <th className="num">Utskick</th>
                    <th className="num">Accepterade</th>
                    <th className="num">Nekade</th>
                    <th className="num">Obesvarade</th>
                    <th className="num">Median svarstid</th>
                  </tr>
                </thead>
                <tbody>
                  {rader.map((r) => (
                    <tr key={r.company_id}>
                      <td>
                        <Link href={`/bolag/${r.company_id}`}>{r.bolag}</Link>
                        {r.premium && <span className="premiummarke">Premium</span>}
                      </td>
                      <td>{r.ort}</td>
                      <td className="num">{tal(r.utskick)}</td>
                      <td className="num">{tal(r.accepterade)}</td>
                      <td className="num">{tal(r.nekade)}</td>
                      <td className="num">{tal(r.obesvarade)}</td>
                      <td className="num">
                        {r.median_svarstid_timmar != null ? `${Number(r.median_svarstid_timmar)} h` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Totalt</td>
                    <td className="num">{tal(totalt.utskick)}</td>
                    <td className="num">{tal(totalt.accepterade)}</td>
                    <td className="num">{tal(totalt.nekade)}</td>
                    <td className="num">{tal(totalt.obesvarade)}</td>
                    <td className="num" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="admin-not">
            En förfrågan räknas till den månad du godkände den — det är då den blev synlig för bolaget. Förfrågningar
            du nekat i granskningen finns inte med alls; de har aldrig nått något bolag.
          </p>
        </div>
      </section>
    </div>
  );
}
