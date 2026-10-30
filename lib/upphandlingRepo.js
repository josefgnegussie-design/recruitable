import { randomBytes } from "node:crypto";
import { hashaToken, rimligToken } from "@/lib/inbjudningar";
import { fornamn } from "@/lib/inquiries";
import { arOppen, byggTackning, idag, kravMedSvar } from "@/lib/upphandling";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allt utom köparens kontaktuppgifter och token. Listan står här och inte som
// "*" i varje fråga, så att en ny kolumn med kontaktuppgifter inte följer med
// ut till besökarna av sig själv.
const PUBLIKA_KOLUMNER =
  "id, title, description, service, buyer_type, buyer_description, name_visibility, contract_period, volume, " +
  "cities, competences, focus_areas, requirements, questions_deadline, interest_deadline, decision_date, " +
  "contract_start, moderation_status, closed_at, created_at";

// Köparens hemliga länk. Samma form som uppföljningslänkarna: bara hashen sparas.
export function nyKopartoken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashaToken(token) };
}

export function koparSokvag(token) {
  return `/upphandling/hantera/${token}`;
}

// Tabellen saknas tills migrationen körts. En tom lista och en okörd migration
// ska inte se likadana ut, så anroparen får veta vilket det är.
function saknasTabell(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function publik(rad) {
  const { requester_company: foretag, ...resten } = rad;
  return { ...resten, kopare_namn: rad.name_visibility === "direkt" ? foretag ?? null : null };
}

export async function hamtaOppnaUpphandlingar(admin) {
  const { data, error } = await admin
    .from("procurements")
    .select(`${PUBLIKA_KOLUMNER}, requester_company`)
    .eq("moderation_status", "approved")
    .is("closed_at", null)
    .gte("interest_deadline", idag())
    .order("interest_deadline", { ascending: true })
    .limit(200);

  if (error) {
    console.error(
      saknasTabell(error)
        ? "procurements saknas — kör supabase/migration_upphandling.sql."
        : `Kunde inte läsa upphandlingar: ${JSON.stringify(error)}`
    );
    return { lista: [], otillganglig: true };
  }
  return { lista: (data || []).map(publik), otillganglig: false };
}

// Modereringsgrinden ligger här: en ogranskad eller nekad upphandling finns
// inte för någon utanför kön. Avslutade får ligga kvar, så att en länk i ett
// mejl visar att upphandlingen är stängd i stället för 404.
export async function hamtaPublikUpphandling(admin, id) {
  if (typeof id !== "string" || !UUID_RE.test(id)) return null;
  const { data } = await admin
    .from("procurements")
    .select(`${PUBLIKA_KOLUMNER}, requester_company, procurement_questions(id, question, answer, answered_at)`)
    .eq("id", id)
    .eq("moderation_status", "approved")
    .maybeSingle();

  if (!data) return null;
  const { procurement_questions: fragor, ...rad } = data;
  return {
    ...publik(rad),
    oppen: arOppen(rad),
    // Obesvarade frågor visas inte: ingen ska kunna skriva något på sidan utan
    // att köparen först har läst det.
    fragor: (fragor || [])
      .filter((f) => f.answer)
      .sort((a, b) => a.answered_at.localeCompare(b.answered_at))
      .map((f) => ({ id: f.id, fraga: f.question, svar: f.answer })),
  };
}

const BOLAGSFALT = "id, name, slug, employees, ka, iso_certifications, auktorisation, retired_at";

function anmalanForKopare(rad, krav) {
  const svar = rad.requirement_answers || {};
  return {
    id: rad.id,
    namn: rad.companies?.name ?? "Bolag",
    profil: rad.companies ? `/bolag/${rad.companies.slug || rad.companies.id}` : null,
    medarbetare: rad.companies?.employees || "",
    tackning: rad.coverage || [],
    krav: (krav || []).map((k) => ({
      id: k.id,
      text: k.text,
      niva: k.niva,
      uppfylls: Boolean(svar[k.id]?.uppfylls),
      kalla: svar[k.id]?.kalla || "bolaget",
    })),
    kapacitet: rad.capacity,
    referens: rad.reference,
    meddelande: rad.message,
    samarbete: rad.open_to_partner,
    epost: rad.contact_email,
    kortlista: rad.status === "kortlista",
    anmald: rad.created_at,
  };
}

// Allt på köparens sida. Null för en felaktig token, och sidan svarar då 404
// oavsett om den var felformad eller bara okänd.
export async function hamtaKoparvy(admin, token) {
  if (!rimligToken(token)) return null;

  const { data } = await admin
    .from("procurements")
    .select(
      `${PUBLIKA_KOLUMNER}, requester_name, procurement_questions(id, question, answer, created_at), ` +
        `procurement_interests(id, coverage, requirement_answers, capacity, reference, message, open_to_partner, ` +
        `contact_email, status, created_at, companies(${BOLAGSFALT}))`
    )
    .eq("token_hash", hashaToken(token))
    .maybeSingle();

  if (!data) return null;

  const { procurement_interests: intressen, procurement_questions: fragor, requester_name: namn, ...rad } = data;
  const anmalningar = (intressen || [])
    .map((i) => anmalanForKopare(i, rad.requirements))
    .sort((a, b) => a.anmald.localeCompare(b.anmald));

  return {
    ...rad,
    fornamn: fornamn(namn),
    oppen: arOppen(rad),
    anmalningar,
    tackning: byggTackning(rad.cities, rad.competences, anmalningar),
    fragor: (fragor || [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((f) => ({ id: f.id, fraga: f.question, svar: f.answer })),
  };
}

// Raden bakom en token, för skrivningarna. Bara det routen behöver.
export async function hamtaForToken(admin, token, kolumner) {
  if (!rimligToken(token)) return null;
  const { data } = await admin.from("procurements").select(kolumner).eq("token_hash", hashaToken(token)).maybeSingle();
  return data;
}

export async function hamtaBolagForUpphandling(admin, companyId) {
  const { data } = await admin
    .from("companies")
    .select("id, name, slug, ka, iso_certifications, auktorisation, focus, city, office_cities")
    .eq("id", companyId)
    .maybeSingle();
  return data;
}

// Fliken på Mina sidor: öppna upphandlingar, de som matchar bolagets
// yrkesområden först, plus allt bolaget redan anmält sig till.
export async function hamtaUpphandlingarForBolag(admin, companyId) {
  const [{ lista, otillganglig }, bolag, { data: egna }] = await Promise.all([
    hamtaOppnaUpphandlingar(admin),
    hamtaBolagForUpphandling(admin, companyId),
    admin
      .from("procurement_interests")
      .select("procurement_id, status, decision_notified_at, procurements(id, title, interest_deadline, closed_at)")
      .eq("company_id", companyId),
  ]);

  const anmalda = new Set((egna || []).map((e) => e.procurement_id));
  const fokus = new Set(bolag?.focus || []);
  const matchar = (u) => u.focus_areas.some((o) => fokus.has(o));

  return {
    otillganglig,
    oppna: lista
      .filter((u) => !anmalda.has(u.id))
      .map((u) => ({ ...u, matchar: matchar(u) }))
      .sort((a, b) => Number(b.matchar) - Number(a.matchar)),
    anmalda: (egna || [])
      .filter((e) => e.procurements)
      .map((e) => ({
        id: e.procurements.id,
        titel: e.procurements.title,
        sista: e.procurements.interest_deadline,
        avslutad: Boolean(e.procurements.closed_at),
        vidare: Boolean(e.decision_notified_at) && e.status === "kortlista",
      })),
  };
}

// En upphandling sedd av ett leverantörsbolag. Köparens namn lämnas ut först när
// bolaget anmält intresse, av samma skäl som förfrågningarnas lead-gräns i
// lib/inquiries.js: namnet räcker för att gå förbi plattformen.
export async function hamtaForLeverantor(admin, id, companyId) {
  const upphandling = await hamtaPublikUpphandling(admin, id);
  if (!upphandling) return null;

  const [bolag, { data: anmalan }, { data: kontakt }] = await Promise.all([
    hamtaBolagForUpphandling(admin, companyId),
    admin
      .from("procurement_interests")
      .select("coverage, requirement_answers, capacity, reference, message, open_to_partner")
      .eq("procurement_id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
    admin.from("procurements").select("requester_company").eq("id", id).maybeSingle(),
  ]);

  const tidigareSvar = Object.fromEntries(
    Object.entries(anmalan?.requirement_answers || {}).map(([k, v]) => [k, v.uppfylls])
  );

  return {
    upphandling: {
      ...upphandling,
      kopare_namn: upphandling.kopare_namn || (anmalan ? kontakt?.requester_company ?? null : null),
    },
    bolag: bolag ? { id: bolag.id, namn: bolag.name } : null,
    krav: kravMedSvar(upphandling.requirements, bolag || {}, tidigareSvar),
    anmalan: anmalan || null,
  };
}

export { UUID_RE };
