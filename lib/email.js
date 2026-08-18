import { Resend } from "resend";
import { platformAdminEmails } from "@/lib/platformAdmin";

const FROM = "Recruitable <forfragan@recruitable.se>";
const SITE = "https://recruitable.se";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// Gemensam mall — alla mejl delar samma Recruitable-branding
// (mörk header, vitt kort, orange call-to-action-knapp) istället
// för att varje mejltyp bygger sin egen HTML från grunden.
// ============================================================
function renderEmail({ eyebrow, title, bodyHtml, ctaLabel, ctaHref, footerHtml }) {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16211f;">
    <div style="background:#0f2229;padding:22px 28px;border-radius:10px 10px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:11px;">
          <div style="width:15px;height:15px;background:#d97b3f;border-radius:3px;transform:rotate(45deg);-ms-transform:rotate(45deg);"></div>
        </td>
        <td>
          <span style="color:#f2efe9;font-size:19px;font-weight:600;letter-spacing:0.2px;">Recruitable</span>
        </td>
      </tr></table>
    </div>
    <div style="border:1px solid #ddd9d1;border-top:none;border-radius:0 0 10px 10px;padding:28px;">
      ${eyebrow ? `<p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 10px;">${escapeHtml(eyebrow)}</p>` : ""}
      ${title ? `<h2 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h2>` : ""}
      <div style="font-size:15px;line-height:1.6;">${bodyHtml}</div>
      ${
        ctaLabel && ctaHref
          ? `<a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#d97b3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:22px;">${escapeHtml(ctaLabel)}</a>`
          : ""
      }
      ${footerHtml ? `<p style="margin:22px 0 0;font-size:12.5px;color:#828b89;">${footerHtml}</p>` : ""}
    </div>
  </div>`;
}

// Alla utskick går genom den här — enda stället som pratar med Resend,
// enda stället som loggar/sväljer fel så en trasig mejlfunktion aldrig
// får krascha den anropande routen (förfrågan/kontot finns redan sparat
// oavsett om mejlet går fram).
async function send({ to, subject, html, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.error(`RESEND_API_KEY saknas — hoppar över mejl "${subject}" till ${to}.`);
    return null;
  }
  const resend = getClient();
  try {
    const result = await resend.emails.send({ from: FROM, to, replyTo, subject, html, text });
    if (result?.error) {
      console.error(`Resend-fel för "${subject}" till ${to}:`, JSON.stringify(result.error));
    }
    return result;
  } catch (err) {
    console.error(`Kunde inte skicka "${subject}" till ${to}:`, err);
    return null;
  }
}

// ============================================================
// 1. Bekräftelse till KUNDEN när de skickat en förfrågan — fungerar som
// ett kvitto: hela företaget de representerar och hela förfrågan
// redovisas, så de svart på vitt ser vad som skickats och till vilka
// bolag, innan något bolag ens hunnit granska den.
// ============================================================
export async function sendInquiryConfirmationToRequester(inquiry) {
  const tags = [inquiry.searchRole, inquiry.focusArea, inquiry.service].filter(Boolean);
  const tagsHtml = tags.length
    ? `<p style="margin:0 0 14px;">${tags
        .map(
          (t) =>
            `<span style="display:inline-block;background:#f4f2ee;border:1px solid #ddd9d1;border-radius:999px;padding:4px 10px;font-size:12px;color:#3d4644;margin:0 6px 6px 0;">${escapeHtml(t)}</span>`
        )
        .join("")}</p>`
    : "";

  const companyNames = inquiry.companyNames || [];

  const html = renderEmail({
    eyebrow: "Förfrågan mottagen",
    title: `Tack, ${inquiry.requesterName.split(" ")[0]}!`,
    bodyHtml: `
      <p style="margin:0 0 16px;">Vi har tagit emot er förfrågan och den granskas nu av Recruitable innan den går vidare till era valda bolag.</p>

      <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 8px;">Ert bolag</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        <b>${escapeHtml(inquiry.requesterCompany)}</b> · ${escapeHtml(inquiry.requesterRole)}<br>
        ${escapeHtml(inquiry.requesterCity)}${inquiry.region ? ` · ${escapeHtml(inquiry.region)}` : ""}${inquiry.requesterWebsite ? ` · ${escapeHtml(inquiry.requesterWebsite)}` : ""}<br>
        ${escapeHtml(inquiry.requesterEmail)}${inquiry.requesterPhone ? ` · ${escapeHtml(inquiry.requesterPhone)}` : ""}
      </p>

      <p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 8px;">Er förfrågan</p>
      ${tagsHtml}
      <p style="white-space:pre-wrap;margin:0 0 16px;">${escapeHtml(inquiry.description)}</p>

      ${
        companyNames.length
          ? `<p style="font-size:11px;letter-spacing:0.5px;text-transform:uppercase;color:#828b89;margin:0 0 8px;">Skickad till</p>
      <p style="margin:0 0 16px;font-size:14px;">${companyNames.map(escapeHtml).join(", ")}</p>`
          : ""
      }

      <p style="margin:0 0 16px;">Så snart den är godkänd ser de valda bolagen förfrågan ovan och kan höra av sig direkt till er på ${escapeHtml(inquiry.requesterEmail)}.</p>
      <p style="margin:0;">Granskningen sker omgående, men hör av er till <a href="mailto:info@recruitable.se" style="color:#0f2229;">info@recruitable.se</a> om ni undrar något under tiden.</p>
    `,
    footerHtml: `Detta är en automatisk bekräftelse — ni behöver inte svara på det här mejlet.`,
  });

  const tagsText = tags.length ? `Söker: ${tags.join(" · ")}\n` : "";
  const companiesText = companyNames.length ? `\nSkickad till: ${companyNames.join(", ")}\n` : "";

  const text = `Tack, ${inquiry.requesterName.split(" ")[0]}!

Vi har tagit emot er förfrågan och den granskas nu av Recruitable innan den går vidare till era valda bolag.

Ert bolag: ${inquiry.requesterCompany} (${inquiry.requesterRole}), ${inquiry.requesterCity}${inquiry.region ? `, ${inquiry.region}` : ""}
${inquiry.requesterWebsite ? `${inquiry.requesterWebsite}\n` : ""}${inquiry.requesterEmail}${inquiry.requesterPhone ? ` · ${inquiry.requesterPhone}` : ""}

Er förfrågan:
${tagsText}"${inquiry.description}"
${companiesText}
Så snart den är godkänd ser de valda bolagen förfrågan ovan och kan höra av sig direkt till er på ${inquiry.requesterEmail}.

Granskningen sker omgående, men hör av er till info@recruitable.se om ni undrar något under tiden.

— Recruitable`;

  return send({
    to: inquiry.requesterEmail,
    subject: "Vi har tagit emot er förfrågan",
    html,
    text,
  });
}

// ============================================================
// 2. Notis till PLATTFORMSADMIN (dig) om ny förfrågan att granska
// ============================================================
export async function sendModerationAlertToAdmins(inquiry) {
  const admins = platformAdminEmails();
  if (!admins.length) {
    console.error("PLATFORM_ADMIN_EMAILS saknas — kan inte skicka granskningsnotis.");
    return null;
  }

  const html = renderEmail({
    eyebrow: "Ny förfrågan att granska",
    title: inquiry.requesterCompany,
    bodyHtml: `
      <p style="margin:0 0 8px;">${escapeHtml(inquiry.requesterName)} · ${escapeHtml(inquiry.requesterRole)} · ${escapeHtml(inquiry.requesterCity)}</p>
      <p style="white-space:pre-wrap;margin:0 0 16px;">"${escapeHtml(inquiry.description)}"</p>
    `,
    ctaLabel: "Granska i kön",
    ctaHref: `${SITE}/admin/moderera-forfragningar`,
  });

  const text = `Ny förfrågan att granska: ${inquiry.requesterCompany}

${inquiry.requesterName} (${inquiry.requesterRole}), ${inquiry.requesterCity}
"${inquiry.description}"

Granska: ${SITE}/admin/moderera-forfragningar`;

  return send({
    to: admins,
    subject: `Ny förfrågan att granska — ${inquiry.requesterCompany}`,
    html,
    text,
  });
}

// ============================================================
// 3. Mejl till BOLAGEN när de fått en förfrågan (godkänd)
// Medvetet inte anropad någonstans än — se kommentar i
// app/api/forfragan/skicka/route.js. Aktiveras när Josef säger till.
// ============================================================
export async function sendInquiryReceivedToCompany({ to, inquiry }) {
  const tags = [inquiry.searchRole, inquiry.focusArea, inquiry.service].filter(Boolean);
  const tagsHtml = tags.length
    ? `<p style="margin:0 0 16px;">${tags
        .map(
          (t) =>
            `<span style="display:inline-block;background:#f4f2ee;border:1px solid #ddd9d1;border-radius:999px;padding:4px 10px;font-size:12px;color:#3d4644;margin:0 6px 6px 0;">${escapeHtml(t)}</span>`
        )
        .join("")}</p>`
    : "";

  const html = renderEmail({
    eyebrow: "Ny förfrågan",
    title: inquiry.requesterCompany,
    bodyHtml: `
      <p style="margin:0 0 18px;color:#6b7573;font-size:14px;">
        ${escapeHtml(inquiry.requesterCity)}
      </p>
      ${tagsHtml}
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(inquiry.description)}</p>
    `,
    ctaLabel: "Se förfrågan på Mina sidor",
    ctaHref: `${SITE}/mina-sidor`,
    footerHtml: `Kontaktuppgifterna till avsändaren visas på Mina sidor så snart ni klickat Acceptera där.`,
  });

  const tagsText = tags.length ? `Söker: ${tags.join(" · ")}\n` : "";
  const text = `Ni har fått en förfrågan via Recruitable.

${inquiry.requesterCompany}, ${inquiry.requesterCity}
${tagsText}"${inquiry.description}"

Logga in på Mina sidor för att acceptera eller neka förfrågan: ${SITE}/mina-sidor
Kontaktuppgifterna till avsändaren visas där så snart ni klickat Acceptera.

— Recruitable`;

  return send({
    to,
    subject: `Ny förfrågan via Recruitable — ${inquiry.requesterCompany}`,
    html,
    text,
  });
}

// recipients: array of { contact } — bolag som ska meddelas.
// Wrapper runt sendInquiryReceivedToCompany för flera mottagare samtidigt.
// Anropas medvetet inte än, se ovan.
export async function sendInquiryEmails({ recipients, inquiry }) {
  const targets = recipients.filter((c) => c.contact);
  return Promise.allSettled(targets.map((c) => sendInquiryReceivedToCompany({ to: c.contact, inquiry })));
}

// ============================================================
// 4b. Notis till PLATTFORMSADMIN när ett bolag accepterat/nekat en
// förfrågan. Tillsammans med #2 ger detta en mejlspårbar logg av hela
// kedjan (skickad → granskad → bolagets beslut), utöver statusen som
// redan lagras i inquiry_recipients. Se /admin/logg för själva loggboken.
// ============================================================
export async function sendRecipientDecisionToAdmin({ inquiry, companyName, decision }) {
  const admins = platformAdminEmails();
  if (!admins.length) {
    console.error("PLATFORM_ADMIN_EMAILS saknas — kan inte skicka beslutsnotis.");
    return null;
  }

  const decidedLabel = decision === "accepted" ? "Accepterad" : "Nekad";
  const decidedVerb = decision === "accepted" ? "accepterat" : "nekat";

  const html = renderEmail({
    eyebrow: decidedLabel,
    title: companyName,
    bodyHtml: `
      <p style="margin:0 0 8px;">${escapeHtml(companyName)} har ${decidedVerb} förfrågan från <b>${escapeHtml(inquiry.requesterCompany)}</b>.</p>
      <p style="white-space:pre-wrap;margin:0;color:#6b7573;font-size:14px;">"${escapeHtml(inquiry.description)}"</p>
    `,
    ctaLabel: "Se hela loggboken",
    ctaHref: `${SITE}/admin/logg`,
  });

  const text = `${companyName} har ${decidedVerb} förfrågan från ${inquiry.requesterCompany}.

"${inquiry.description}"

Loggbok: ${SITE}/admin/logg`;

  return send({
    to: admins,
    subject: `${decidedLabel} — ${companyName} · ${inquiry.requesterCompany}`,
    html,
    text,
  });
}

// ============================================================
// 4. Bekräftelse när ett lösenord byts (Kontoinställningar)
// ============================================================
export async function sendPasswordChangedEmail(email) {
  const html = renderEmail({
    bodyHtml: `
      <p style="margin:0 0 16px;">Ditt lösenord har ändrats.</p>
      <p style="margin:0;color:#828b89;font-size:13px;">Var det inte du som gjorde det? Kontakta oss omgående på <a href="mailto:info@recruitable.se" style="color:#828b89;">info@recruitable.se</a>.</p>
    `,
  });
  const text = `Ditt lösenord har ändrats.

Var det inte du som gjorde det? Kontakta oss omgående på info@recruitable.se.

— Recruitable`;

  return send({ to: email, subject: "Ditt lösenord har bytts", html, text });
}

// ============================================================
// Bevakning: premiumprofiler som inte syns som de ska
// Skickas av /api/cron/premium-koll, inte av något användarflöde.
// ============================================================
export async function sendPremiumAlertToAdmins({ problems }) {
  const admins = platformAdminEmails();
  if (!admins.length) {
    console.error("PLATFORM_ADMIN_EMAILS saknas — kan inte larma om premiumprofiler.");
    return null;
  }

  const rows = problems
    .map(
      (p) =>
        `<li style="margin:0 0 8px;"><strong>${escapeHtml(p.company)}</strong><br />${escapeHtml(p.issue)}</li>`
    )
    .join("");

  const html = renderEmail({
    eyebrow: "Bevakning av premiumprofiler",
    title: `${problems.length} ${problems.length === 1 ? "profil behöver" : "profiler behöver"} ses över`,
    bodyHtml: `<ul style="margin:0 0 16px;padding-left:18px;">${rows}</ul>`,
    ctaLabel: "Öppna registret",
    ctaHref: `${SITE}/rekrytera`,
  });

  const text = [
    `Bevakning av premiumprofiler — ${problems.length} problem:`,
    "",
    ...problems.map((p) => `- ${p.company}: ${p.issue}`),
  ].join("\n");

  return send({
    to: admins,
    subject: `Premiumprofiler att se över (${problems.length})`,
    html,
    text,
  });
}

// ============================================================
// 5. Kontaktformulär — auto-svar till avsändaren
// ============================================================
export async function sendContactAutoReply({ to, name }) {
  const html = renderEmail({
    bodyHtml: `
      <p style="margin:0 0 16px;">Hej${name ? " " + escapeHtml(name.split(" ")[0]) : ""}!</p>
      <p style="margin:0;">Tack att du hör av dig. Vi har mottagit ditt mejl och återkommer till dig snarast möjligt.</p>
    `,
  });
  const text = `Hej${name ? " " + name.split(" ")[0] : ""}!

Tack att du hör av dig. Vi har mottagit ditt mejl och återkommer till dig snarast möjligt.

— Recruitable`;

  return send({ to, subject: "Vi har tagit emot ditt meddelande", html, text });
}

// ============================================================
// 6. Kontaktformulär — notis till PLATTFORMSADMIN
// ============================================================
export async function sendContactNotificationToAdmin({ name, email, message }) {
  const admins = platformAdminEmails();
  if (!admins.length) {
    console.error("PLATFORM_ADMIN_EMAILS saknas — kan inte skicka kontaktnotis.");
    return null;
  }

  const html = renderEmail({
    eyebrow: "Nytt meddelande via kontaktformuläret",
    title: name,
    bodyHtml: `
      <p style="margin:0 0 16px;color:#6b7573;font-size:14px;">${escapeHtml(email)}</p>
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(message)}</p>
    `,
    footerHtml: `Svara direkt på det här mejlet så går det till ${escapeHtml(email)}.`,
  });
  const text = `Nytt meddelande via kontaktformuläret

${name} (${email})
"${message}"`;

  return send({ to: admins, replyTo: email, subject: `Nytt meddelande — ${name}`, html, text });
}
