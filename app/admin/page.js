import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { andel, forandring, hamtaStatistik, PERIODER, tolkaPeriod } from "@/lib/statistik";
import {
  Dagsdiagram,
  Manadsdiagram,
  MigrationSaknas,
  Nyckeltal,
  Topplista,
  Utfallsstapel,
  tal,
} from "@/components/admin/Statistikvy";

export const dynamic = "force-dynamic";

const FILTERNAMN = { omrade: "Yrkesområden", tjanst: "Tjänster", ort: "Orter" };

// Fyller ut dagarna utan trafik med nollor. Utan det hoppar diagrammet över
// tomma dygn och en vecka utan besökare ser ut som en vecka som inte fanns.
function fyllDagar(rader, antalDagar) {
  const per = new Map((rader || []).map((r) => [r.dag, r]));
  const idag = Date.now();

  return Array.from({ length: antalDagar }, (_, i) => {
    const d = new Date(idag - (antalDagar - 1 - i) * 24 * 60 * 60 * 1000);
    const nyckel = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
    const rad = per.get(nyckel);
    return {
      dag: nyckel,
      sidvisningar: Number(rad?.sidvisningar || 0),
      besokare: Number(rad?.besokare || 0),
    };
  });
}

// Samma sak för månaderna: en månad utan en enda förfrågan finns inte som rad
// i databasen, och skulle utan det här försvinna ur diagrammet istället för att
// synas som den nolla den är.
function fyllManader(rader, antalManader) {
  const per = new Map((rader || []).map((r) => [String(r.manad).slice(0, 7), r]));
  const nu = new Date();

  return Array.from({ length: antalManader }, (_, i) => {
    const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - (antalManader - 1 - i), 1));
    const nyckel = d.toISOString().slice(0, 7);
    const rad = per.get(nyckel);
    return {
      manad: nyckel,
      etikett: d.toLocaleDateString("sv-SE", { year: "numeric", month: "long", timeZone: "UTC" }),
      kort: d.toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" }),
      utskick: Number(rad?.utskick || 0),
      accepterade: Number(rad?.accepterade || 0),
      nekade: Number(rad?.nekade || 0),
      obesvarade: Number(rad?.obesvarade || 0),
    };
  });
}

function summera(rader, falt) {
  return (rader || []).reduce((s, r) => s + Number(r[falt] || 0), 0);
}

// Recruitables egen dashboard. Svarar på tre frågor på en gång: används
// sajten, leder användningen till förfrågningar, och vad blev det av dem.
export default async function AdminOversikt({ searchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const period = tolkaPeriod(params?.period);
  const admin = createAdminClient();

  const [
    trafik,
    trafikForr,
    toppsidor,
    sokfilter,
    forfragningar,
    forfragningarForr,
    manader,
    sokningar,
    bolag,
    premiumbolag,
    overtagna,
    konton,
  ] = await Promise.all([
    hamtaStatistik("statistik_trafik", { p_fran: period.fran, p_till: period.till }),
    hamtaStatistik("statistik_trafik", { p_fran: period.foregaende.fran, p_till: period.foregaende.till }),
    hamtaStatistik("statistik_toppsidor", { p_fran: period.fran, p_till: period.till, p_antal: 10 }),
    hamtaStatistik("statistik_sokfilter", { p_fran: period.fran, p_till: period.till, p_antal: 60 }),
    hamtaStatistik("statistik_forfragningar", { p_fran: period.fran, p_till: period.till }),
    hamtaStatistik("statistik_forfragningar", {
      p_fran: period.foregaende.fran,
      p_till: period.foregaende.till,
    }),
    hamtaStatistik("statistik_utfall_per_manad", { p_manader: 12 }),
    admin
      .from("site_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "sokning")
      .gte("occurred_at", period.fran)
      .lt("occurred_at", period.till),
    admin.from("companies").select("id", { count: "exact", head: true }),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("is_premium", true),
    admin.from("companies").select("id", { count: "exact", head: true }).eq("claimed", true),
    admin.from("company_admins").select("id", { count: "exact", head: true }).eq("verified", true),
  ]);

  const saknasStatistik = trafik.saknasMigration || forfragningar.saknasMigration;

  const dagar = fyllDagar(trafik.data, period.dagar);
  const sidvisningar = summera(trafik.data, "sidvisningar");
  const sidvisningarForr = summera(trafikForr.data, "sidvisningar");
  const besokare = summera(trafik.data, "besokare");
  const matBesokare = Boolean(process.env.STATISTIK_SALT);

  const f = forfragningar.data?.[0] || {};
  const ff = forfragningarForr.data?.[0] || {};

  const utskick = Number(f.utskick || 0);
  const accepterade = Number(f.accepterade || 0);
  const nekade = Number(f.nekade || 0);
  const obesvarade = Number(f.obesvarade || 0);
  const besvarade = accepterade + nekade;

  const manadsrader = fyllManader(manader.data, 12);

  const filterPerFalt = Object.fromEntries(
    Object.keys(FILTERNAMN).map((falt) => [
      falt,
      (sokfilter.data || [])
        .filter((r) => r.falt === falt)
        .slice(0, 8)
        .map((r) => ({ etikett: r.varde, varde: Number(r.antal) })),
    ])
  );

  const antalSokningar = sokningar.count || 0;

  return (
    <div className="admin-sida">
      <div className="admin-rubrikrad">
        <div>
          <h1 className="admin-h1">Översikt</h1>
          <p className="admin-ingress">
            Senaste {period.etikett.toLowerCase()}, jämfört med de {period.dagar} dagarna dessförinnan.
          </p>
        </div>
        <div className="periodval">
          {Object.entries(PERIODER).map(([dagarVal, etikett]) => (
            <Link
              key={dagarVal}
              href={`/admin?period=${dagarVal}`}
              className={Number(dagarVal) === period.dagar ? "aktiv" : ""}
            >
              {etikett}
            </Link>
          ))}
        </div>
      </div>

      {saknasStatistik && <MigrationSaknas fil="supabase/migration_statistik.sql" />}

      {/* ---------- Aktivitet ---------- */}
      <section className="admin-block">
        <h2 className="admin-h2">Aktivitet på sajten</h2>
        <Nyckeltal
          poster={[
            {
              etikett: "Sidvisningar",
              varde: tal(sidvisningar),
              forandring: forandring(sidvisningar, sidvisningarForr),
            },
            {
              etikett: "Besökare",
              varde: matBesokare ? tal(besokare) : "—",
              hjalp: matBesokare
                ? "Unika per dygn, cookielöst räknade."
                : "Kräver STATISTIK_SALT i miljövariablerna.",
            },
            {
              etikett: "Sökningar",
              varde: tal(antalSokningar),
              hjalp: "Sökningar med minst ett filter.",
            },
            {
              etikett: "Förfrågningar in",
              varde: tal(f.inkomna || 0),
              forandring: forandring(Number(f.inkomna || 0), Number(ff.inkomna || 0)),
            },
          ]}
        />
        <div className="admin-panel">
          <h3 className="admin-h3">Sidvisningar per dag</h3>
          {trafik.saknasMigration ? (
            <p className="tomt">Väntar på att statistiktabellen skapas.</p>
          ) : (
            <Dagsdiagram dagar={dagar} />
          )}
        </div>
        <div className="admin-tva">
          <div className="admin-panel">
            <h3 className="admin-h3">Mest besökta sidor</h3>
            <Topplista
              rader={(toppsidor.data || []).map((r) => ({
                etikett: r.path,
                varde: Number(r.sidvisningar),
              }))}
              tom="Inga sidvisningar i perioden."
            />
          </div>
          <div className="admin-panel">
            <h3 className="admin-h3">Vad besökarna söker på</h3>
            {Object.entries(FILTERNAMN).map(([falt, namn]) => (
              <div key={falt} className="sokfilter-grupp">
                <p className="sokfilter-rubrik">{namn}</p>
                <Topplista rader={filterPerFalt[falt]} tom="Inga sökningar med det här filtret." />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Förfrågningar ---------- */}
      <section className="admin-block">
        <h2 className="admin-h2">Förfrågningar och utfall</h2>
        <Nyckeltal
          poster={[
            {
              etikett: "Utskick till bolag",
              varde: tal(utskick),
              hjalp: "Godkända förfrågningar × mottagande bolag.",
              forandring: forandring(utskick, Number(ff.utskick || 0)),
            },
            {
              etikett: "Accepterade",
              varde: tal(accepterade),
              suffix: andel(accepterade, utskick) !== null ? ` (${andel(accepterade, utskick)} %)` : "",
              forandring: forandring(accepterade, Number(ff.accepterade || 0)),
            },
            {
              etikett: "Nekade",
              varde: tal(nekade),
              suffix: andel(nekade, utskick) !== null ? ` (${andel(nekade, utskick)} %)` : "",
            },
            {
              etikett: "Svarsfrekvens",
              varde: andel(besvarade, utskick) !== null ? `${andel(besvarade, utskick)} %` : "—",
              hjalp:
                f.median_svarstid_timmar != null
                  ? `Median svarstid ${Number(f.median_svarstid_timmar)} h.`
                  : "Ingen svarstid att räkna på än.",
            },
          ]}
        />
        <div className="admin-tva">
          <div className="admin-panel">
            <h3 className="admin-h3">Utfall i perioden</h3>
            <Utfallsstapel accepterade={accepterade} nekade={nekade} obesvarade={obesvarade} />
            <p className="admin-not">
              Bara förfrågningar du godkänt räknas här. En förfrågan som nekats i granskningen har aldrig nått
              något bolag och hör varken hemma i svarsfrekvensen eller på en faktura.
            </p>
          </div>
          <div className="admin-panel">
            <h3 className="admin-h3">Granskningsläget</h3>
            <Topplista
              rader={[
                { etikett: "Godkända av dig", varde: Number(f.godkanda || 0) },
                { etikett: "Väntar på granskning", varde: Number(f.vantar_granskning || 0) },
                { etikett: "Nekade av dig", varde: Number(f.nekade_av_oss || 0) },
              ]}
              tom="Inga förfrågningar i perioden."
            />
            <p className="admin-not">
              <Link href="/admin/moderera-forfragningar">Till granskningskön</Link>
            </p>
          </div>
        </div>
        <div className="admin-panel">
          <h3 className="admin-h3">Utfall per månad</h3>
          <Manadsdiagram manader={manadsrader} />
          <p className="admin-not">
            Månaden räknas från när du godkände förfrågan — det är då bolaget kunde agera på den, och det är den
            månaden den hör till på fakturan. <Link href="/admin/fakturering">Till faktureringsunderlaget</Link>
          </p>
        </div>
      </section>

      {/* ---------- Registret ---------- */}
      <section className="admin-block">
        <h2 className="admin-h2">Registret</h2>
        <Nyckeltal
          poster={[
            { etikett: "Bolag i registret", varde: tal(bolag.count || 0) },
            {
              etikett: "Övertagna profiler",
              varde: tal(overtagna.count || 0),
              hjalp: "Bolag som själva tagit över sin profil.",
            },
            { etikett: "Premiumbolag", varde: tal(premiumbolag.count || 0) },
            { etikett: "Godkända bolagskonton", varde: tal(konton.count || 0) },
          ]}
        />
      </section>
    </div>
  );
}
