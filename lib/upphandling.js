import { kanoniskOrt } from "@/lib/helpers";
import { GILTIGA_TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { sorteradeIso } from "@/lib/iso";

// Reglerna för upphandlingar, utan databas och utan mejl, så att formulären och
// routes läser samma gränser. Ett tak som bara finns i formuläret blir ett
// formulär som släpper igenom något servern avvisar, eller tvärtom.
export const MAX_ORTER = 12;
export const MAX_KOMPETENSER = 8;
export const MAX_OMRADEN = 5;
export const MAX_KRAV = 12;
export const MAX_ORD_I_PRESENTATION = 150;

// Färdiga krav. `profil` säger att svaret går att läsa ur bolagets profil, så
// att leverantören slipper fylla i det och köparen ser varifrån uppgiften kommer.
export const KRAV_MALL = [
  { id: "kollektivavtal", text: "Kollektivavtal eller motsvarande villkor", niva: "ska", profil: "ka" },
  { id: "forsakring", text: "Ansvarsförsäkring", niva: "ska", profil: null },
  { id: "iso9001", text: "ISO 9001", niva: "bor", profil: "ISO 9001" },
  { id: "iso14001", text: "ISO 14001", niva: "bor", profil: "ISO 14001" },
  { id: "auktorisation", text: "Auktoriserad av Kompetensföretagen", niva: "bor", profil: "auktorisation" },
];

const PROFILKALLOR = new Set(KRAV_MALL.map((k) => k.profil).filter(Boolean));
const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
const EPOST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function valfriText(v, max) {
  return v === undefined || v === null || (typeof v === "string" && v.length <= max);
}

// Dagens datum i Sverige. Sista dagen ska gälla hela dagen, även för den som
// anmäler sig efter midnatt UTC men före midnatt här, eller tvärtom.
export function idag() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

export function raknaOrdIText(v) {
  const rensad = String(v || "").trim();
  return rensad ? rensad.split(/\s+/).length : 0;
}

function unika(lista) {
  const sedda = new Set();
  return lista.filter((v) => {
    const nyckel = v.toLowerCase();
    if (sedda.has(nyckel)) return false;
    sedda.add(nyckel);
    return true;
  });
}

// Kraven kontrolleras ett i taget: `profil` får bara ha ett känt värde, annars
// kan en förfalskad begäran peka svaret på vad som helst.
function rensadeKrav(krav) {
  if (!Array.isArray(krav) || krav.length > MAX_KRAV) return null;
  const ut = [];
  for (const k of krav) {
    if (!k || !text(k.id, 40) || !text(k.text, 160)) return null;
    if (k.niva !== "ska" && k.niva !== "bor") return null;
    if (k.profil && !PROFILKALLOR.has(k.profil)) return null;
    ut.push({ id: k.id, text: k.text.trim(), niva: k.niva, profil: k.profil || null });
  }
  return new Set(ut.map((k) => k.id)).size === ut.length ? ut : null;
}

// Innehållet i en upphandling som rad för databasen, eller { fel } med något
// som går att visa för köparen. Kontaktuppgifterna kontrolleras i routen.
export function valideraUpphandling(b) {
  if (!text(b.titel, 120)) return { fel: "Ange en rubrik på högst 120 tecken." };
  if (!text(b.beskrivning, 1500)) return { fel: "Beskriv upphandlingen med högst 1 500 tecken." };
  if (!text(b.kopare, 120)) return { fel: "Beskriv vilken typ av bolag ni är." };
  if (!GILTIGA_TJANSTER.has(b.tjanst)) return { fel: "Välj en tjänst." };
  if (b.kopartyp !== "privat" && b.kopartyp !== "offentlig") return { fel: "Välj vem som köper." };
  if (b.synlighet !== "efter_intresse" && b.synlighet !== "direkt") return { fel: "Välj när ert namn ska visas." };
  if (!valfriText(b.avtalstid, 80) || !valfriText(b.volym, 120)) return { fel: "Avtalstid eller volym är för lång." };

  if (!Array.isArray(b.orter)) return { fel: "Lägg till minst en ort." };
  const orter = unika(b.orter.map(kanoniskOrt).filter(Boolean));
  if (orter.length !== b.orter.length) return { fel: "Orterna måste vara svenska kommuner och får bara anges en gång." };
  if (!orter.length || orter.length > MAX_ORTER) return { fel: `Ange mellan 1 och ${MAX_ORTER} orter.` };

  if (!Array.isArray(b.kompetenser) || !b.kompetenser.every((k) => text(k, 40))) {
    return { fel: "Varje kompetens får vara högst 40 tecken." };
  }
  const kompetenser = unika(b.kompetenser.map((k) => k.trim()));
  if (!kompetenser.length || kompetenser.length > MAX_KOMPETENSER) {
    return { fel: `Ange mellan 1 och ${MAX_KOMPETENSER} kompetenser.` };
  }

  if (
    !Array.isArray(b.omraden) ||
    !b.omraden.length ||
    b.omraden.length > MAX_OMRADEN ||
    !b.omraden.every((o) => Object.hasOwn(YRKESOMRADEN, o))
  ) {
    return { fel: `Välj mellan 1 och ${MAX_OMRADEN} yrkesområden.` };
  }

  const krav = rensadeKrav(b.krav);
  if (!krav) return { fel: `Kontrollera kraven. Högst ${MAX_KRAV} krav får anges.` };

  for (const d of [b.sistaFraga, b.sistaIntresse, b.besked]) {
    if (typeof d !== "string" || !DATUM_RE.test(d)) return { fel: "Fyll i alla datum i tidplanen." };
  }
  if (b.avtalsstart && !DATUM_RE.test(b.avtalsstart)) return { fel: "Ogiltig avtalsstart." };
  if (b.sistaIntresse < idag()) return { fel: "Sista dag att anmäla intresse har redan passerat." };
  if (b.sistaFraga > b.sistaIntresse) return { fel: "Sista dag för frågor måste ligga före sista dag att anmäla intresse." };
  if (b.besked < b.sistaIntresse) return { fel: "Besked till leverantörerna kan inte ges före sista dag att anmäla intresse." };

  return {
    rad: {
      title: b.titel.trim(),
      description: b.beskrivning.trim(),
      service: b.tjanst,
      buyer_type: b.kopartyp,
      buyer_description: b.kopare.trim(),
      name_visibility: b.synlighet,
      contract_period: b.avtalstid?.trim() || null,
      volume: b.volym?.trim() || null,
      cities: orter,
      competences: kompetenser,
      focus_areas: [...new Set(b.omraden)],
      requirements: krav,
      questions_deadline: b.sistaFraga,
      interest_deadline: b.sistaIntresse,
      decision_date: b.besked,
      contract_start: b.avtalsstart || null,
    },
  };
}

export function valideraKontakt(b) {
  if (
    !text(b.namn, 100) ||
    typeof b.epost !== "string" ||
    !EPOST_RE.test(b.epost.trim()) ||
    b.epost.length > 254 ||
    !text(b.webbplats, 200) ||
    !text(b.roll, 100) ||
    !text(b.foretag, 200) ||
    !text(b.ort, 100) ||
    !valfriText(b.telefon, 30)
  ) {
    return false;
  }
  return true;
}

// Vad bolagets profil säger om ett krav. Null när profilen inte svarar, och då
// är det bolagets egen uppgift som gäller.
function svarUrProfil(krav, bolag) {
  if (krav.profil === "ka") return bolag.ka ? true : null;
  if (krav.profil === "auktorisation") return bolag.auktorisation?.length ? true : null;
  if (krav.profil) return sorteradeIso(bolag.iso_certifications).some((c) => c.kod === krav.profil) ? true : null;
  return null;
}

// Kraven med bolagets svar. Det som står i profilen räknas alltid som uppfyllt
// och kan inte kryssas ur: köparen ska kunna lita på att "enligt profilen"
// verkligen kommer därifrån, oavsett vad webbläsaren skickar.
export function kravMedSvar(krav, bolag, svar = {}) {
  return (krav || []).map((k) => {
    const ur = svarUrProfil(k, bolag);
    return {
      ...k,
      uppfylls: ur === true || svar[k.id] === true,
      kalla: ur === true ? "profil" : "bolaget",
    };
  });
}

export function rensadTackning(tackning, orter, kompetenser) {
  if (!Array.isArray(tackning)) return null;
  const giltiga = new Set(orter.flatMap((o) => kompetenser.map((k) => `${o}|${k}`)));
  const valda = new Set();
  for (const t of tackning) {
    const nyckel = `${t?.ort}|${t?.kompetens}`;
    if (!giltiga.has(nyckel)) return null;
    valda.add(nyckel);
  }
  return [...valda].map((n) => {
    const i = n.indexOf("|");
    return { ort: n.slice(0, i), kompetens: n.slice(i + 1) };
  });
}

// Matrisen på köparens sida: en rad per ort och i varje ruta vilka som kan leverera.
export function byggTackning(orter, kompetenser, anmalningar) {
  return orter.map((ort) => ({
    ort,
    rutor: kompetenser.map((kompetens) => {
      const bolag = anmalningar.filter((a) =>
        a.tackning.some((t) => t.ort === ort && t.kompetens === kompetens)
      );
      return { kompetens, antal: bolag.length, bolag: bolag.map((a) => a.id) };
    }),
  }));
}

export function tackningsSiffror(rader) {
  const alla = rader.flatMap((r) => r.rutor);
  return {
    totalt: alla.length,
    tackta: alla.filter((r) => r.antal > 0).length,
    enLeverantor: alla.filter((r) => r.antal === 1).length,
    luckor: rader.flatMap((r) => r.rutor.filter((c) => c.antal === 0).map((c) => ({ ort: r.ort, kompetens: c.kompetens }))),
  };
}

export function arOppen(u, dag = idag()) {
  return u.moderation_status === "approved" && !u.closed_at && u.interest_deadline >= dag;
}

export function datumText(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Stockholm",
  });
}
