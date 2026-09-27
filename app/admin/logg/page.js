import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";

const MODERATION_LABEL = { pending: "Väntar granskning", approved: "Godkänd", rejected: "Nekad av Recruitable" };
const STATUS_LABEL = { pending: "Väntar", accepted: "Accepterad", declined: "Tackat nej" };

function formatDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Recruitables egen loggbok — hela kedjan per förfrågan: skickad, granskad,
// och varje mottagande bolags beslut med tidsstämpel. Byggd direkt på samma
// fält som redan styr access (moderation_status, inquiry_recipients.status/
// responded_at) istället för en separat logg som kan hamna ur synk.
export default async function LoggPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();

  const GRUND =
    "id, created_at, moderation_status, requester_name, requester_company, requester_city, description, ";
  const MED_ROUTNING =
    GRUND +
    "inquiry_recipients(id, status, responded_at, notified_email, notified_at, office_id, offices(city), companies(name))";
  const UTAN_ROUTNING = GRUND + "inquiry_recipients(id, status, responded_at, companies(name))";

  const hamta = (kolumner) =>
    admin.from("inquiries").select(kolumner).order("created_at", { ascending: false }).limit(100);

  let { data: rows, error } = await hamta(MED_ROUTNING);

  // Utan reservvägen hade en ej körd migration tömt hela loggboken i stället för
  // att bara dölja routningsraden — och en tom loggbok ser ut som att inga
  // förfrågningar finns, inte som att något saknas.
  if (error) {
    console.warn(
      "Loggboken visas utan routningsuppgifter — kör supabase/migration_forfragan_routing.sql.",
      error.message
    );
    ({ data: rows } = await hamta(UTAN_ROUTNING));
  }

  const inquiries = rows || [];

  return (
    <div style={{ maxWidth: 860, margin: "60px auto", padding: "0 24px 80px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Loggbok</h1>
      <p style={{ color: "var(--color-muted)", marginBottom: 32 }}>
        Senaste {inquiries.length} förfrågningarna, med granskningsstatus och varje bolags beslut. Källan är samma
        databastabeller som styr vad bolagen faktiskt ser, aldrig ur synk med verkligheten.
      </p>

      {inquiries.length === 0 && <p style={{ color: "var(--color-muted)" }}>Inga förfrågningar än.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {inquiries.map((inq) => (
          <div className="auth-panel" key={inq.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15.5 }}>
                  {inq.requester_name} · {inq.requester_company}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--color-muted)" }}>{inq.requester_city}</p>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                {formatDateTime(inq.created_at)}
              </span>
            </div>

            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "var(--color-muted)" }}>
              Granskning:{" "}
              <b style={{ color: "var(--color-ink)" }}>
                {MODERATION_LABEL[inq.moderation_status] || inq.moderation_status}
              </b>
            </p>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {(inq.inquiry_recipients || []).map((r) => (
                <div key={r.id} style={{ fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{r.companies?.name || "Okänt bolag"}</span>
                    <span style={{ color: "var(--color-muted)" }}>
                      {STATUS_LABEL[r.status] || r.status}
                      {r.responded_at ? ` · ${formatDateTime(r.responded_at)}` : ""}
                    </span>
                  </div>
                  {r.notified_email && (
                    // Kvittot på routningen: vilken adress som fick förfrågan,
                    // om det var ett betalt kontors egen, och om mejlet gick
                    // fram. Saknad tid betyder att utskicket misslyckades.
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-muted)" }}>
                      → {r.notified_email}
                      {r.office_id ? ` · kontoret i ${r.offices?.city || "okänd ort"}` : " · bolagets allmänna adress"}
                      {r.notified_at ? ` · mejlat ${formatDateTime(r.notified_at)}` : " · mejlet gick INTE ut"}
                    </p>
                  )}
                </div>
              ))}
              {(inq.inquiry_recipients || []).length === 0 && (
                <span style={{ fontSize: 13, color: "var(--color-muted)" }}>Inga mottagare</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
