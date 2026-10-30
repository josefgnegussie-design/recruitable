import { skickaMejl, mejlmall, escapeHtml, AVSANDARE, SVARA_TILL, SITE } from "@/lib/email";
import { notisEmails } from "@/lib/platformAdmin";
import { datumText } from "@/lib/upphandling";

// Utskicken kring upphandlingar. Mejl till köparen bär aldrig länken till
// hantera-sidan utom i kvittot: token sparas bara som hash, så kvittot är enda
// tillfället den finns att skicka. Övriga mejl hänvisar dit.
const SE_KVITTOT = "Öppna er sida via länken i bekräftelsemejlet ni fick när ni lade ut upphandlingen.";

function stycke(t) {
  return `<p style="margin:0 0 14px;">${t}</p>`;
}

// 1. Kvitto till köparen, med den hemliga länken.
export async function sendUpphandlingKvitto({ till, fornamn, titel, lank }) {
  const url = `${SITE}${lank}`;
  const html = mejlmall({
    eyebrow: "Upphandling mottagen",
    title: `Tack, ${fornamn}!`,
    bodyHtml:
      stycke(`Vi har tagit emot <b>${escapeHtml(titel)}</b>. Recruitable granskar den innan den publiceras.`) +
      stycke("Via knappen nedan följer ni vilka leverantörer som anmäler sig och vilka orter och kompetenser som är täckta. Länken är personlig, så spara mejlet och dela den bara med dem som ska se leverantörernas svar."),
    ctaLabel: "Öppna er upphandling",
    ctaHref: url,
  });
  const text = `Tack, ${fornamn}!

Vi har tagit emot ${titel}. Recruitable granskar den innan den publiceras.

Här följer ni leverantörernas anmälningar:
${url}

Länken är personlig, så spara mejlet.

— Recruitable`;

  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: SVARA_TILL,
    to: till,
    subject: `Vi har tagit emot er upphandling — ${titel}`,
    html,
    text,
  });
}

// 2. Notis till oss om en upphandling att granska.
export async function sendUpphandlingAttGranska({ foretag, namn, titel, beskrivning }) {
  const admins = notisEmails();
  if (!admins.length) {
    console.error("PLATFORM_ADMIN_EMAILS saknas — kan inte skicka granskningsnotis.");
    return null;
  }
  const url = `${SITE}/admin/upphandlingar`;
  return skickaMejl({
    from: AVSANDARE.admin,
    to: admins,
    subject: `Ny upphandling att granska — ${foretag}`,
    html: mejlmall({
      eyebrow: "Ny upphandling att granska",
      title: titel,
      bodyHtml:
        stycke(`${escapeHtml(foretag)} · ${escapeHtml(namn)}`) +
        `<p style="white-space:pre-wrap;margin:0;">${escapeHtml(beskrivning)}</p>`,
      ctaLabel: "Granska i kön",
      ctaHref: url,
    }),
    text: `Ny upphandling att granska: ${titel}\n\n${foretag}, ${namn}\n\n${beskrivning}\n\nGranska: ${url}`,
  });
}

// 3. Besked till köparen när granskningen är klar.
export async function sendUpphandlingBeslut({ till, titel, godkand, id }) {
  const rubrik = godkand ? "Er upphandling är publicerad" : "Er upphandling publicerades inte";
  const brod = godkand
    ? `${titel} är nu öppen för leverantörer. ${SE_KVITTOT}`
    : `Vi kunde inte publicera ${titel}. Hör av er till info@recruitable.se så berättar vi varför.`;
  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: SVARA_TILL,
    to: till,
    subject: rubrik,
    html: mejlmall({
      eyebrow: "Upphandling",
      title: rubrik,
      bodyHtml: stycke(escapeHtml(brod)),
      ctaLabel: godkand ? "Se den publicerade sidan" : undefined,
      ctaHref: godkand ? `${SITE}/upphandling/${id}` : undefined,
    }),
    text: `${rubrik}\n\n${brod}\n\n— Recruitable`,
  });
}

// 4. Till leverantörer vars yrkesområde matchar. Går ut innan bolaget anmält
// intresse, så köparens namn står bara med om köparen valt att visa det.
export async function sendUpphandlingTillBolag({ till, u }) {
  const url = `${SITE}/mina-sidor/upphandling/${u.id}`;
  const kopare = u.kopare_namn || u.buyer_description;
  const fakta = `${u.service} · ${u.cities.join(", ")} · sista dag ${datumText(u.interest_deadline)}`;
  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: SVARA_TILL,
    to: till,
    subject: `Ny upphandling via Recruitable — ${u.title}`,
    html: mejlmall({
      eyebrow: "Ny upphandling",
      title: u.title,
      bodyHtml:
        stycke(escapeHtml(kopare)) +
        stycke(escapeHtml(fakta)) +
        `<p style="white-space:pre-wrap;margin:0;">${escapeHtml(u.description)}</p>`,
      ctaLabel: "Se upphandlingen",
      ctaHref: url,
      footerHtml: "Ni får mejlet för att upphandlingen gäller ett yrkesområde som står i er profil.",
    }),
    text: `Ny upphandling: ${u.title}\n\n${kopare}\n${fakta}\n\n${u.description}\n\nSe upphandlingen: ${url}\n\n— Recruitable`,
  });
}

// 5. Till köparen vid varje ny anmälan.
export async function sendUpphandlingNyAnmalan({ till, titel, bolag, antalKombinationer }) {
  const rad = `${bolag} har anmält intresse för ${titel} och kan leverera ${antalKombinationer} ${
    antalKombinationer === 1 ? "kombination" : "kombinationer"
  } av ort och kompetens.`;
  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: SVARA_TILL,
    to: till,
    subject: `Ny intresseanmälan — ${titel}`,
    html: mejlmall({
      eyebrow: "Ny intresseanmälan",
      title: bolag,
      bodyHtml: stycke(escapeHtml(rad)) + stycke(escapeHtml(SE_KVITTOT)),
    }),
    text: `${rad}\n\n${SE_KVITTOT}\n\n— Recruitable`,
  });
}

// 6. Till köparen när en leverantör ställt en fråga. Avsändaren står inte med:
// frågorna är anonyma.
export async function sendUpphandlingNyFraga({ till, titel, fraga }) {
  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: SVARA_TILL,
    to: till,
    subject: `Ny fråga — ${titel}`,
    html: mejlmall({
      eyebrow: "Ny fråga från en leverantör",
      title: titel,
      bodyHtml:
        `<p style="white-space:pre-wrap;margin:0 0 14px;">${escapeHtml(fraga)}</p>` +
        stycke(`Svaret visas för alla leverantörer. ${escapeHtml(SE_KVITTOT)}`),
    }),
    text: `Ny fråga om ${titel}:\n\n${fraga}\n\nSvaret visas för alla leverantörer. ${SE_KVITTOT}\n\n— Recruitable`,
  });
}

// 7. Besked till leverantörerna när köparen avslutar. Den som går vidare får
// köparens kontaktuppgifter; övriga får ett kort tack.
export async function sendUpphandlingBesked({ till, titel, vidare, kopare }) {
  const rubrik = vidare ? "Ni går vidare" : "Ni gick inte vidare den här gången";
  const brod = vidare
    ? `${kopare.foretag} vill gå vidare med er i ${titel}. Ta kontakt med ${kopare.namn}, ${kopare.epost}${
        kopare.telefon ? `, ${kopare.telefon}` : ""
      }.`
    : `Köparen har valt andra leverantörer i ${titel}. Tack för er anmälan.`;
  return skickaMejl({
    from: AVSANDARE.forfragan,
    replyTo: vidare ? kopare.epost : SVARA_TILL,
    to: till,
    subject: `${rubrik} — ${titel}`,
    html: mejlmall({ eyebrow: "Besked om upphandling", title: rubrik, bodyHtml: stycke(escapeHtml(brod)) }),
    text: `${rubrik}\n\n${brod}\n\n— Recruitable`,
  });
}
