import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";

// Det Mina sidor visar när kontot inte är redo att administrera ett bolag.
// Samma besked oavsett vilken flik man försökte nå, så att en sparad länk till
// en förfrågan inte ger ett annat svar än /mina-sidor.
//
// Utloggningen finns i huvudmenyn, som syns även här.
export default async function MinaSidorStatus({ tillstand, adminRow }) {
  if (tillstand === "granskas") return <UnderGranskning adminRow={adminRow} />;

  const text = {
    saknas: "Vi hittar ingen bolagskoppling för det här kontot. Kontakta info@recruitable.se.",
    okopplad: "Ert konto är godkänt men ännu inte kopplat till ett bolag. Kontakta info@recruitable.se.",
  }[tillstand];

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <p>{text}</p>
    </div>
  );
}

// Ett konto som väntar på godkännande såg förut bara en rad text. Rutan säger
// vad som händer härnäst, ungefär när, och vart man vänder sig.
async function UnderGranskning({ adminRow }) {
  // Bolaget kan redan finnas i registret — de flesta som registrerar sig tar
  // över ett befintligt kort. Det slås upp på organisationsnumret med den
  // publika klienten, som bara ser det alla besökare ser.
  let profil = null;
  const orgnr = String(adminRow?.claimed_org_number || "").replace(/\D/g, "");
  if (orgnr.length === 10) {
    const medStreck = `${orgnr.slice(0, 6)}-${orgnr.slice(6)}`;
    const { data } = await createPublicClient()
      .from("companies")
      .select("id, slug, name")
      .or(`org_number.eq.${orgnr},org_number.eq.${medStreck}`)
      .limit(1)
      .maybeSingle();
    profil = data;
  }

  const inskickad = adminRow?.created_at
    ? new Date(adminRow.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 640, margin: "48px auto 80px", padding: "0 24px" }}>
      <div className="auth-panel granskning-ruta" role="status">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Under granskning</div>
        <h1 className="filter-title" style={{ fontSize: 22, marginBottom: 10 }}>
          {adminRow?.claimed_company_name
            ? `Vi går igenom ansökan för ${adminRow.claimed_company_name}`
            : "Vi går igenom er ansökan"}
        </h1>
        <p style={{ fontSize: 14.5 }}>
          {inskickad ? `Ansökan kom in ${inskickad}. ` : ""}
          Vi kontrollerar att e-postadressen hör till bolaget och kopplar kontot till rätt bolagskort. Det tar
          vanligtvis en till två arbetsdagar.
        </p>
        <ol className="granskning-steg">
          <li className="klart">Konto skapat och ansökan inskickad</li>
          <li className="pagar">Recruitable granskar ansökan</li>
          <li>Ni får ett mejl när kontot är godkänt, och kan sedan fylla i profilen och svara på förfrågningar här</li>
        </ol>
        <p style={{ fontSize: 14 }}>
          Frågor, eller har det gått mer än två arbetsdagar? Mejla{" "}
          <a href="mailto:info@recruitable.se">info@recruitable.se</a>.
        </p>
        {profil && (
          <p style={{ fontSize: 14, marginBottom: 0 }}>
            Så här ser {profil.name} ut i registret i dag:{" "}
            <Link href={`/bolag/${profil.slug || profil.id}`}>se den publika profilen</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
