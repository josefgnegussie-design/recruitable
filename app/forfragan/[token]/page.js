import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaUppfoljning } from "@/lib/uppfoljning";

// Läses vid varje besök, så att ett bolags svar syns så fort beställaren
// laddar om sidan.
export const dynamic = "force-dynamic";

// Länken i bekräftelsemejlet är personlig och ska inte hamna i ett sökindex.
export const metadata = {
  title: "Er förfrågan",
  robots: { index: false, follow: false },
};

const STATUS = {
  granskas: { text: "Väntar på granskning", klass: "" },
  vantar: { text: "Väntar på svar", klass: "" },
  intresserad: { text: "Intresserad", klass: "accepted" },
  "tackat-nej": { text: "Tackat nej", klass: "declined" },
  stoppad: { text: "Skickades inte", klass: "declined" },
};

function datum(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", timeZone: "Europe/Stockholm" });
}

function sammanfattning(f) {
  if (f.granskning === "rejected") {
    return "Recruitable godkände inte förfrågan, så den gick inte vidare till bolagen. Hör av er till info@recruitable.se om ni undrar varför.";
  }
  if (f.granskning !== "approved") {
    return "Förfrågan granskas av Recruitable. Så snart den är godkänd ser bolagen den och kan svara.";
  }
  const intresserade = f.bolag.filter((b) => b.status === "intresserad").length;
  const vantar = f.bolag.filter((b) => b.status === "vantar").length;
  const delar = [];
  if (intresserade) delar.push(`${intresserade} ${intresserade === 1 ? "bolag är intresserat" : "bolag är intresserade"} och hör av sig till er`);
  if (vantar) delar.push(`${vantar} har inte svarat än`);
  return delar.length ? `${delar.join(", ")}.` : "Alla bolag har svarat.";
}

export default async function UppfoljningPage({ params }) {
  const { token } = await params;
  const forfragan = await hamtaUppfoljning(createAdminClient(), token);

  // Felformad och okänd token ger samma svar, så att adressen inte avslöjar
  // något om vilka förfrågningar som finns.
  if (!forfragan) notFound();

  return (
    <div id="view-uppfoljning">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 720, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">Er förfrågan · skickad {datum(forfragan.skickad)}</div>
          <h1 className="hero-title">
            {forfragan.fornamn ? `Hej ${forfragan.fornamn}, ` : ""}
            <em>så här går det</em>
          </h1>
          <p className="hero-sub">{sammanfattning(forfragan)}</p>
        </div>
      </section>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="auth-panel">
          {forfragan.taggar.length > 0 && (
            <div className="tag-row" style={{ marginBottom: 10 }}>
              {forfragan.taggar.map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{forfragan.beskrivning}</p>
        </div>

        <h2 style={{ fontSize: 18, margin: "12px 0 0" }}>Bolagen ({forfragan.bolag.length})</h2>
        <ul className="uppfoljning-lista">
          {forfragan.bolag.map((b) => (
            <li key={b.id} className="auth-panel">
              <div className="uppfoljning-rad">
                <Link href={b.profil} style={{ fontWeight: 600, fontSize: 16 }}>{b.namn}</Link>
                <span className={`status-pill ${STATUS[b.status].klass}`}>{STATUS[b.status].text}</span>
              </div>
              {b.meddelande && (
                <blockquote className="uppfoljning-meddelande">
                  {b.meddelande}
                  <span>— {b.namn}</span>
                </blockquote>
              )}
              {b.status === "intresserad" && (
                <p className="uppfoljning-not">
                  Bolaget har fått era kontaktuppgifter och hör av sig direkt till er
                  {b.besvarad ? ` (svarade ${datum(b.besvarad)})` : ""}.
                </p>
              )}
              {b.status === "tackat-nej" && b.besvarad && (
                <p className="uppfoljning-not">Svarade {datum(b.besvarad)}.</p>
              )}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0 }}>
          Sidan uppdateras när ett bolag svarar. Spara länken, eller hitta den igen i bekräftelsemejlet. Vill ni nå
          fler bolag? <Link href="/rekrytera">Skicka en ny förfrågan</Link>.
        </p>
      </div>
    </div>
  );
}
