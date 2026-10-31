import RegisterForm from "@/components/admin/RegisterForm";
import { hamtaBolagMedSlug } from "@/lib/companiesRepo";
import { bolagsdoman, hinderForOvertagande } from "@/lib/overtagande";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ?bolag=<slug> kommer från inbjudningssidan /valkommen/[slug] och från
// profilsidans "Ta över profilen". Då är bolaget redan känt och formuläret kan
// hoppa direkt till kontot.
export default async function RegistreraPage({ searchParams }) {
  const params = await searchParams;
  const slug = typeof params?.bolag === "string" ? params.bolag : null;
  const bolag = slug ? await hamtaBolagMedSlug(slug) : null;

  const hinder = bolag
    ? hinderForOvertagande({ claimed: bolag.claimed, upphort: Boolean(bolag.retiredAt) })
    : null;

  const forifyllt =
    bolag && !hinder
      ? { slug: bolag.slug, namn: bolag.name, doman: bolagsdoman(bolag.link) }
      : null;

  // Inloggad utan bolag, till exempel efter ett avslag. Kontot finns redan, så
  // formuläret ska inte be om lösenord.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div id="view-registrera">
      {/* Rubriken och formuläret delar vänsterkant. Förut var rubriken
          vänsterställd i en 640-spalt och formuläret centrerat i en smalare,
          så de två blocken stod förskjutna mot varandra. */}
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto", paddingBottom: 28 }}>
        <div>
          <div className="eyebrow">För bemannings- och rekryteringsföretag</div>
          <h1 className="hero-title">{forifyllt ? `Ta över ${forifyllt.namn}` : "Ta över ert bolag"}</h1>
          <p className="hero-sub">
            {forifyllt && !forifyllt.doman
              ? "Skapa ett konto och bekräfta din adress. Bolaget saknar webbplats i registret, så vi kontrollerar ansökan för hand. Sedan kan du fylla i profilen och bjuda in kollegor."
              : "Skapa ett konto med en mejladress på bolagets egen domän. Bekräfta adressen, så är du bolagets administratör direkt och kan fylla i profilen och bjuda in kollegor."}
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 480 }}>
          {hinder ? (
            <div className="auth-panel">
              <p style={{ margin: 0 }}>{hinder.text}</p>
            </div>
          ) : (
            <RegisterForm forifyllt={forifyllt} inloggadEpost={user?.email ?? null} />
          )}
        </div>
      </div>
    </div>
  );
}
