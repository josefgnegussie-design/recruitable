"use client";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

export default function InquiriesList({ inquiries }) {
  if (inquiries.length === 0) {
    return (
      <p style={{ marginTop: 24, color: "var(--color-muted)" }}>
        Inga förfrågningar än. När någon hittar er via Rekrytera-sidan och skickar en förfrågan dyker den upp
        här.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {inquiries.map((inq) => (
        <div className="auth-panel" key={inq.recipientId}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{inq.requester_company}</p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                {inq.requester_name} · {inq.requester_role} · {inq.requester_city}
              </p>
            </div>
            <span style={{ fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
              {formatDate(inq.receivedAt)}
            </span>
          </div>

          {(inq.focus_area || inq.service || inq.search_role) && (
            <div className="tag-row" style={{ marginTop: 10 }}>
              {inq.search_role && <span className="tag">{inq.search_role}</span>}
              {inq.focus_area && <span className="tag">{inq.focus_area}</span>}
              {inq.service && <span className="tag">{inq.service}</span>}
            </div>
          )}

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5 }}>{inq.description}</p>

          <div style={{ marginTop: 14 }}>
            <a className="btn btn-primary" href={`mailto:${inq.requester_email}`} style={{ display: "inline-block" }}>
              Svara {inq.requester_name.split(" ")[0]}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
