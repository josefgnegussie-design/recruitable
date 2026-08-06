import { Resend } from "resend";

const FROM = "Recruitable <forfragan@recruitable.se>";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSubject(inquiry) {
  return `Ny förfrågan via Recruitable — ${inquiry.requesterCompany}`;
}

function buildText(inquiry) {
  const tags = [inquiry.searchRole, inquiry.focusArea, inquiry.service].filter(Boolean).join(" · ");
  return `Ni har fått en förfrågan via Recruitable.

${inquiry.requesterName} (${inquiry.requesterRole}) på ${inquiry.requesterCompany}, ${inquiry.requesterCity}
${tags ? `Söker: ${tags}\n` : ""}
"${inquiry.description}"

Svara direkt på det här mejlet så går det rakt till ${inquiry.requesterName} på ${inquiry.requesterEmail}.

Ni ser även förfrågan under Mina sidor på recruitable.se.

— Recruitable`;
}

function buildHtml(inquiry) {
  const tags = [inquiry.searchRole, inquiry.focusArea, inquiry.service].filter(Boolean);
  const tagsHtml = tags.length
    ? `<p style="margin:0 0 16px;">${tags
        .map(
          (t) =>
            `<span style="display:inline-block;background:#f4f2ee;border:1px solid #ddd9d1;border-radius:999px;padding:4px 10px;font-size:12px;color:#3d4644;margin:0 6px 6px 0;">${escapeHtml(
              t
            )}</span>`
        )
        .join("")}</p>`
    : "";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16211f;">
    <div style="background:#0f2229;padding:20px 28px;border-radius:10px 10px 0 0;">
      <span style="color:#f2efe9;font-size:18px;font-weight:600;">Recruitable</span>
    </div>
    <div style="border:1px solid #ddd9d1;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
      <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 10px;">Ny förfrågan</p>
      <h2 style="margin:0 0 4px;font-size:20px;">${escapeHtml(inquiry.requesterCompany)}</h2>
      <p style="margin:0 0 18px;color:#6b7573;font-size:14px;">
        ${escapeHtml(inquiry.requesterName)} · ${escapeHtml(inquiry.requesterRole)} · ${escapeHtml(inquiry.requesterCity)}
      </p>
      ${tagsHtml}
      <p style="font-size:15px;line-height:1.6;white-space:pre-wrap;margin:0 0 24px;">${escapeHtml(inquiry.description)}</p>
      <a href="mailto:${escapeHtml(inquiry.requesterEmail)}" style="display:inline-block;background:#d97b3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Svara ${escapeHtml(inquiry.requesterName.split(" ")[0])}</a>
      <p style="margin:22px 0 0;font-size:12.5px;color:#828b89;">
        Svara direkt på det här mejlet så går det rakt till ${escapeHtml(inquiry.requesterName)}. Ni ser även
        förfrågan under <a href="https://recruitable.se/mina-sidor" style="color:#828b89;">Mina sidor</a>.
      </p>
    </div>
  </div>`;
}

// recipients: array of { contact } — bolag som ska meddelas.
// inquiry: { requesterName, requesterEmail, requesterRole, requesterCompany, requesterCity, description, searchRole, focusArea, service }
// Best effort — misslyckade utskick kastar aldrig, de bara loggas. Förfrågan finns redan sparad i databasen oavsett.
export async function sendInquiryEmails({ recipients, inquiry }) {
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY saknas — hoppar över mejlutskick.");
    return [];
  }

  const resend = getClient();
  const targets = recipients.filter((c) => c.contact);

  const results = await Promise.allSettled(
    targets.map((c) =>
      resend.emails.send({
        from: FROM,
        to: c.contact,
        replyTo: inquiry.requesterEmail,
        subject: buildSubject(inquiry),
        html: buildHtml(inquiry),
        text: buildText(inquiry),
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`Kunde inte skicka mejl till ${targets[i].contact}:`, r.reason);
    } else if (r.value?.error) {
      console.error(`Resend-fel för ${targets[i].contact}:`, JSON.stringify(r.value.error));
    }
  });

  return results;
}
