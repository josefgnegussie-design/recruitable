import { after } from "next/server";
import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { hashaToken, rimligToken } from "@/lib/inbjudningar";
import { resolveCompanyContacts } from "@/lib/offices";
import { sendInquiryReceivedToCompany, sendModerationAlertToAdmins } from "@/lib/email";
import { fornamn } from "@/lib/inquiries";

// Automatisk granskning av förfrågningar och upphandlingsinbjudningar. Se
// supabase/migration_automatisk_granskning.sql för hela flödet.
//
// Det manuella godkännandet svarade i praktiken på två frågor: är avsändaren
// den den säger sig vara, och ser förfrågan ut som en riktig förfrågan? Den
// första besvaras nu av bekräftelselänken: bara den som kan läsa mejl på
// adressen kan släppa förfrågan, och domänen är redan kontrollerad mot
// webbplatsen. Den andra av kontrollerna i granskningsorsaker(). Allt som
// fastnar där går till kön som förut, så inget avvikande når bolagen utan att
// någon tittat på det.

export function nyBekraftelsetoken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashaToken(token) };
}

// Länken i mejlet går till uppföljningssidan, med bekräftelsetoken som
// parameter. Uppföljningslänken ensam räcker inte som bevis: tacksidan visar
// den i webbläsaren, så den kan ha setts av någon som aldrig haft tillgång till
// adressen.
export function bekraftelseSokvag(uppfoljningsSokvag, token) {
  return `${uppfoljningsSokvag}?bekrafta=${token}`;
}

export { rimligToken as rimligBekraftelsetoken };

// ------------------------------------------------------------
// Domänen måste kunna ta emot mejl. Annars kan bekräftelsen aldrig komma
// fram, och adressen är med all sannolikhet påhittad. Ett DNS-fel som inte
// säger något om domänen (timeout, nätverk) stoppar inte förfrågan: då får
// bekräftelselänken avgöra.
// ------------------------------------------------------------
const DNS_TIMEOUT_MS = 3000;

export async function domanTarEmotMejl(doman) {
  if (!doman) return false;
  try {
    const mx = await Promise.race([
      dns.resolveMx(doman),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), DNS_TIMEOUT_MS)),
    ]);
    // "Null MX" (RFC 7505): domänen säger uttryckligen att den inte tar emot mejl.
    return mx.some((post) => post.exchange && post.exchange !== ".");
  } catch (err) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") return false;
    console.error(`MX-uppslaget för ${doman} misslyckades (${err?.code || err?.message}) — släpper igenom.`);
    return true;
  }
}

// ------------------------------------------------------------
// Kontrollerna efter bekräftelsen. Varje träff är en mening som visas i
// granskningskön och i notisen, så att det går att se varför den fastnade.
// ------------------------------------------------------------
export const MIN_BESKRIVNING = 30;
const MAX_PER_DOMAN_OCH_DYGN = 2;
const DUBBLETT_DAGAR = 30;
const LIKHET_DUBBLETT = 0.8;

const LANK_RE = /(https?:\/\/|www\.)\S+|\b[\w.-]+\.(se|com|nu|net|org|io)\b/i;
const EPOST_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const TELEFON_RE = /(\+46|\b0)[\s-]?\d{1,3}([\s-]?\d{2,4}){2,4}\b/;

function normalisera(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Andel gemensamma ord (Jaccard). Fångar samma text med små ändringar, utan
// att ge utslag för två korta förfrågningar som råkar dela "lagerpersonal".
export function likhet(a, b) {
  const A = new Set(normalisera(a));
  const B = new Set(normalisera(b));
  if (A.size < 4 || B.size < 4) return normalisera(a).join(" ") === normalisera(b).join(" ") ? 1 : 0;
  let gemensamma = 0;
  for (const ord of A) if (B.has(ord)) gemensamma++;
  return gemensamma / (A.size + B.size - gemensamma);
}

function domanAv(epost) {
  return String(epost || "").split("@")[1]?.trim().toLowerCase() || "";
}

function foretagsnamn(namn) {
  return normalisera(String(namn || "").replace(/\b(ab|aktiebolag|hb|kb|publ)\b/gi, "")).join(" ");
}

// Innehållskontrollerna, utan databas. Separat för att kunna testas för sig.
export function innehallsorsaker(inquiry) {
  const orsaker = [];
  const beskrivning = String(inquiry.description || "").trim();
  if (beskrivning.length < MIN_BESKRIVNING) {
    orsaker.push(`Beskrivningen är kort (${beskrivning.length} tecken).`);
  }
  if (LANK_RE.test(beskrivning) || EPOST_RE.test(beskrivning) || TELEFON_RE.test(beskrivning)) {
    orsaker.push("Beskrivningen innehåller en länk, e-postadress eller ett telefonnummer.");
  }
  return orsaker;
}

export async function granskningsorsaker(admin, inquiry) {
  const orsaker = innehallsorsaker(inquiry);
  const doman = domanAv(inquiry.requester_email);

  const sedan = new Date(Date.now() - DUBBLETT_DAGAR * 24 * 3600 * 1000).toISOString();
  const { data: tidigare, error } = await admin
    .from("inquiries")
    .select("id, created_at, description, requester_email, requester_company, moderation_status, upphandling")
    .neq("id", inquiry.id)
    .neq("moderation_status", "unconfirmed")
    .gte("created_at", sedan)
    .limit(500);

  // Utan jämförelsedata går det inte att säga att förfrågan är vanlig. Då
  // granskas den hellre en gång för mycket.
  if (error) {
    console.error("Kunde inte hämta tidigare förfrågningar för granskningen:", JSON.stringify(error));
    return [...orsaker, "Kunde inte jämföra med tidigare förfrågningar."];
  }

  const rader = tidigare || [];
  const dygnSedan = Date.now() - 24 * 3600 * 1000;
  const sammaDomanIdag = rader.filter(
    (r) => domanAv(r.requester_email) === doman && new Date(r.created_at).getTime() >= dygnSedan
  ).length;
  if (sammaDomanIdag + 1 > MAX_PER_DOMAN_OCH_DYGN) {
    orsaker.push(`${sammaDomanIdag + 1} förfrågningar från ${doman} det senaste dygnet.`);
  }

  if (rader.some((r) => likhet(r.description, inquiry.description) >= LIKHET_DUBBLETT)) {
    orsaker.push(`Nästan samma text som en annan förfrågan de senaste ${DUBBLETT_DAGAR} dagarna.`);
  }

  const namn = foretagsnamn(inquiry.requester_company);
  const annanDoman = rader.find(
    (r) => namn && foretagsnamn(r.requester_company) === namn && domanAv(r.requester_email) !== doman
  );
  if (annanDoman) {
    orsaker.push(`Samma företagsnamn har skickat från en annan domän (${domanAv(annanDoman.requester_email)}).`);
  }

  // En upphandling når fler bolag och väger tyngre för dem. Den första från en
  // domän tittar vi därför alltid på; därefter går de automatiskt som allt annat.
  if (inquiry.upphandling) {
    const { count } = await admin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .not("upphandling", "is", null)
      .eq("moderation_status", "approved")
      .ilike("requester_email", `%@${doman}`);
    if (!count) orsaker.push(`Första upphandlingen från ${doman}.`);
  }

  return orsaker;
}

// ------------------------------------------------------------
// Bekräftelsen. Anropas av /api/forfragan/bekrafta. Returnerar
// { status } — 'approved', 'pending' eller samma som förut om den redan var
// bekräftad — eller null om token inte stämmer.
// ------------------------------------------------------------
export async function bekraftaForfragan(admin, { uppfoljningsHash, bekraftelseToken }) {
  if (!rimligToken(bekraftelseToken)) return null;

  const { data: inquiry } = await admin
    .from("inquiries")
    .select(
      "id, moderation_status, description, requester_email, requester_company, requester_name, requester_role, requester_city, upphandling"
    )
    .eq("uppfoljning_token_hash", uppfoljningsHash)
    .eq("bekraftelse_token_hash", hashaToken(bekraftelseToken))
    .maybeSingle();

  if (!inquiry) return null;
  if (inquiry.moderation_status !== "unconfirmed") return { status: inquiry.moderation_status, redan: true };

  const orsaker = await granskningsorsaker(admin, inquiry);
  const nu = new Date().toISOString();

  // Villkoret på 'unconfirmed' gör övergången atomär: två klick samtidigt kan
  // inte båda släppa förfrågan och mejla bolagen två gånger.
  const { data: uppdaterad, error } = await admin
    .from("inquiries")
    .update(
      orsaker.length
        ? { moderation_status: "pending", bekraftad_at: nu, granskningsorsaker: orsaker }
        : { moderation_status: "approved", bekraftad_at: nu, moderated_at: nu, moderated_by: "auto", granskningsorsaker: [] }
    )
    .eq("id", inquiry.id)
    .eq("moderation_status", "unconfirmed")
    .select("id");

  if (error) {
    console.error(`Kunde inte bekräfta förfrågan ${inquiry.id}:`, JSON.stringify(error));
    throw new Error("Kunde inte bekräfta förfrågan.");
  }
  if (!uppdaterad?.length) return { status: "pending", redan: true };

  if (orsaker.length) {
    after(() =>
      sendModerationAlertToAdmins({
        requesterCompany: inquiry.requester_company,
        requesterName: inquiry.requester_name,
        requesterRole: inquiry.requester_role,
        requesterCity: inquiry.requester_city,
        description: inquiry.description,
        orsaker,
      })
    );
    return { status: "pending" };
  }

  await slappForfragan(admin, inquiry.id);
  return { status: "approved" };
}

// ------------------------------------------------------------
// Det som händer när en förfrågan blir synlig för bolagen: mottagarna
// routas till rätt kontor och mejlas. Samma väg för automatiskt och manuellt
// godkända. Flyttad hit ur /api/admin/moderera-forfragan.
// ------------------------------------------------------------
export async function slappForfragan(admin, inquiryId) {
  const { data: inquiry } = await admin
    .from("inquiries")
    .select(
      "description, search_role, focus_area, service, city, region, " +
        "requester_name, requester_role, requester_company, requester_city, " +
        "inquiry_recipients(company_id, companies(id, name, contact, claimed))"
    )
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry) return { mejlade: 0, viaKontor: 0, utanMottagare: 0 };

  // Antal och start hämtas för sig: saknas kolumnerna (migration_antal_start.sql
  // inte körd) ska mejlen till bolagen ändå gå ut, bara utan dem.
  const { data: detaljer } = await admin
    .from("inquiries")
    .select("antal_personer, start_tid")
    .eq("id", inquiryId)
    .maybeSingle();

  const valdaBolag = (inquiry.inquiry_recipients || []).map((r) => r.companies).filter(Boolean);

  // Bara bolag som kan göra något med mejlet får det: de har tagit över sin
  // profil. Ett bolag som inte registrerat sig kan varken logga in och
  // acceptera eller förvänta sig mejl från oss — det hör till
  // informationsutskicket till registret, inte hit.
  //
  // Adressfrågan hör hemma i resolveCompanyContacts, som faller tillbaka på
  // bolagets adress och släpper den utan adress helt.
  const kanSvara = valdaBolag.filter((b) => b.claimed);

  // Förfrågans ort först, avsändarens egen bara som reserv. inquiries.city är
  // orten uppdraget gäller; requester_city är var avsändaren själv sitter.
  const mottagare = await resolveCompanyContacts(kanSvara, [inquiry.city, inquiry.requester_city]);

  // Mejlet går till bolagen INNAN de accepterat, så det får inte bära något som
  // pekar ut kunden: behovet, uppdragets plats, och vem som frågar till
  // förnamn och roll. Samma gräns som mapInquiryRow drar i gränssnittet.
  const forMejl = {
    description: inquiry.description,
    searchRole: inquiry.search_role || "",
    focusArea: inquiry.focus_area || "",
    service: inquiry.service || "",
    antal: detaljer?.antal_personer || null,
    start: detaljer?.start_tid || "",
    city: inquiry.city || "",
    region: inquiry.region || "",
    requesterFirstName: fornamn(inquiry.requester_name),
    requesterRole: inquiry.requester_role || "",
  };

  // Två bolag i samma koncern kan dela kontaktadress: samma adress får ett mejl.
  const adresser = [...new Map(mottagare.map((m) => [m.email.toLowerCase(), m])).values()];

  // Routningsbeslutet sparas innan mejlen går ut, och raderna läses tillbaka
  // för sina id:n: mejlet länkar direkt till förfrågan på Mina sidor.
  const mottagarId = new Map();
  if (mottagare.length) {
    const { data: sparade, error: routningsFel } = await admin
      .from("inquiry_recipients")
      .upsert(
        mottagare.map((m) => ({
          inquiry_id: inquiryId,
          company_id: m.companyId,
          office_id: m.officeId,
          notified_email: m.email,
        })),
        { onConflict: "inquiry_id,company_id" }
      )
      .select("id, company_id");

    for (const rad of sparade ?? []) mottagarId.set(rad.company_id, rad.id);

    if (routningsFel) {
      const saknadKolumn = routningsFel.code === "42703" || routningsFel.code === "PGRST204";
      console.error(
        saknadKolumn
          ? "inquiry_recipients saknar routningskolumnerna — kör supabase/migration_forfragan_routing.sql."
          : `Kunde inte spara routningen för förfrågan ${inquiryId}: ${JSON.stringify(routningsFel)}`
      );
    }
  }

  // after() och inte fire-and-forget: ett utskick utan await fryses i samma
  // ögonblick svaret går iväg.
  if (adresser.length) {
    after(async () => {
      const utfall = await Promise.allSettled(
        adresser.map((m) =>
          sendInquiryReceivedToCompany({ to: m.email, inquiry: forMejl, recipientId: mottagarId.get(m.companyId) })
        )
      );

      // notified_at sätts bara för adresser som verkligen tog emot mejlet.
      const framme = new Set(
        adresser.filter((_, i) => utfall[i].status === "fulfilled").map((m) => m.email.toLowerCase())
      );
      const bolagMedMejl = mottagare.filter((m) => framme.has(m.email.toLowerCase())).map((m) => m.companyId);

      if (bolagMedMejl.length) {
        const { error: tidsFel } = await admin
          .from("inquiry_recipients")
          .update({ notified_at: new Date().toISOString() })
          .eq("inquiry_id", inquiryId)
          .in("company_id", bolagMedMejl);
        if (tidsFel) console.error(`Kunde inte stämpla utskicket för ${inquiryId}:`, JSON.stringify(tidsFel));
      }

      const fel = utfall.filter((u) => u.status === "rejected").length;
      if (fel) console.error(`Förfrågan ${inquiryId}: ${fel} av ${adresser.length} mejl gick inte ut.`);
    });
  }

  return {
    mejlade: mottagare.length,
    viaKontor: mottagare.filter((m) => m.viaKontor).length,
    utanMottagare: valdaBolag.length - mottagare.length,
  };
}
