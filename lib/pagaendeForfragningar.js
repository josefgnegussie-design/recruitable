// Pågående förfrågningar som teaser på /rekrytera, med samma modell som
// pågående upphandlingar på /upphandling. ENDAST SERVERSIDAN — läser inquiries
// med service role.
//
// Bara vanliga förfrågningar: en inbjudan från Upphandling har upphandling
// ifyllt och visas på sin egen sida. Bara förfrågningar där beställaren sagt
// ja till att visas (visa_som_exempel), som Recruitable godkänt och som är
// högst 30 dagar gamla.
//
// Kortet byggs ur fasta val: ort, tjänst, yrkesområde, antalet tillfrågade
// bolag och när stegen hände. Beställarens namn, företag, webbplats och
// beskrivning används aldrig.

import { createAdminClient } from "@/lib/supabase/admin";
import { OMRADE_KORT, TAL, kortDatum, omDagar, versal } from "@/lib/pagaendeUpphandlingar";

const MAX = 6;
const MIN_MED_EXEMPEL = 3;
const DAGAR = 30;

function tal(n) {
  return TAL[n] ?? String(n);
}

// "Bemanning inom lager och logistik", eller bara den ena delen.
export function rubrik(r) {
  const omrade = r.focus_area ? OMRADE_KORT[r.focus_area] ?? r.focus_area.toLowerCase() : "";
  if (r.service && omrade) return `${r.service} inom ${omrade}`;
  return r.service || versal(omrade) || "Personal";
}

// "Företag söker samarbetspartner och har frågat fem bolag. Två har svarat."
export function sammanfattning(antalBolag, antalSvar) {
  const fragat = antalBolag > 0 ? ` och har frågat ${tal(antalBolag)} bolag` : "";
  const svar = antalSvar > 0 ? ` ${versal(tal(antalSvar))} har svarat.` : "";
  return `Företag söker samarbetspartner${fragat}.${svar}`;
}

// Förfrågans fyra steg. Ett steg som inte hänt ännu har inget datum.
export function tidslinje({ skickad, godkand, forstaSvar, forstaKontakt }) {
  return [
    { steg: "Skickad", datum: kortDatum(skickad) },
    { steg: "Godkänd", datum: kortDatum(godkand) },
    { steg: "Svar", datum: kortDatum(forstaSvar) },
    { steg: "Kontakt", datum: kortDatum(forstaKontakt) },
  ];
}

function tidigast(datum) {
  return datum.filter(Boolean).sort()[0] ?? null;
}

function kort(r, mottagare, exempel) {
  const svar = mottagare.filter((m) => m.status === "accepted" || m.status === "declined");
  return {
    orter: r.city || r.region || "",
    rubrik: rubrik(r),
    mening: sammanfattning(mottagare.length, svar.length),
    tidslinje: tidslinje({
      skickad: r.created_at,
      godkand: r.moderated_at,
      forstaSvar: tidigast(svar.map((m) => m.responded_at)),
      forstaKontakt: tidigast(mottagare.filter((m) => m.status === "accepted").map((m) => m.responded_at)),
    }),
    exempel,
    nyckel: r.city || r.region || "",
  };
}

// Mottagare för exemplen: så många bolag, så många svar varav så många ja,
// med svaren dagen efter godkännandet.
function mottagareFor(bolag, svar, ja, svarsdag) {
  return Array.from({ length: bolag }, (_, i) => ({
    status: i < ja ? "accepted" : i < svar ? "declined" : "pending",
    responded_at: i < svar ? omDagar(svarsdag) : null,
  }));
}

function exempel() {
  return [
    [{ city: "Göteborg", service: "Bemanning", focus_area: "Lager, logistik och transport", created_at: omDagar(-5), moderated_at: omDagar(-5) }, mottagareFor(5, 3, 2, -4)],
    [{ city: "Stockholm", service: "Rekrytering", focus_area: "Ekonomi och finans", created_at: omDagar(-2), moderated_at: omDagar(-1) }, mottagareFor(4, 1, 1, 0)],
    [{ city: "Malmö", service: "Konsultuppdrag", focus_area: "IT", created_at: omDagar(-1), moderated_at: omDagar(0) }, mottagareFor(6, 0, 0, 0)],
    [{ city: "Uppsala", service: "Bemanning", focus_area: "Omsorg och socialt arbete", created_at: omDagar(-8), moderated_at: omDagar(-7) }, mottagareFor(3, 2, 1, -6)],
  ].map(([r, m]) => kort(r, m, true));
}

export async function hamtaPagaendeForfragningar() {
  const riktiga = await hamtaRiktiga();
  if (riktiga.length >= MIN_MED_EXEMPEL) return riktiga.map(({ nyckel, ...k }) => k);
  const egna = new Set(riktiga.map((r) => r.nyckel));
  return [...riktiga, ...exempel().filter((e) => !egna.has(e.nyckel))]
    .slice(0, Math.max(riktiga.length, MIN_MED_EXEMPEL))
    .map(({ nyckel, ...k }) => k);
}

async function hamtaRiktiga() {
  try {
    const admin = createAdminClient();
    const sedan = new Date(Date.now() - DAGAR * 864e5).toISOString();
    const { data, error } = await admin
      .from("inquiries")
      .select("id, created_at, moderated_at, service, focus_area, city, region")
      .eq("moderation_status", "approved")
      .eq("visa_som_exempel", true)
      .is("upphandling", null)
      .gte("created_at", sedan)
      .order("created_at", { ascending: false })
      .limit(MAX);
    if (error) throw error;
    if (!data?.length) return [];

    const { data: mottagare, error: mErr } = await admin
      .from("inquiry_recipients")
      .select("inquiry_id, status, responded_at")
      .in("inquiry_id", data.map((r) => r.id));
    if (mErr) throw mErr;

    return data.map((r) => kort(r, (mottagare ?? []).filter((m) => m.inquiry_id === r.id), false));
  } catch (err) {
    // Saknas kolumnen (migrationen inte körd) eller nätet: bara exemplen.
    console.error("Kunde inte läsa pågående förfrågningar:", err.message);
    return [];
  }
}
