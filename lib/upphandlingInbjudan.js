import { kanoniskOrt, regionForCity } from "@/lib/helpers";
import { GILTIGA_TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { idag, KRAV_MALL, MAX_KOMPETENSER, MAX_OMRADEN, MAX_ORTER, valideraKontakt } from "@/lib/upphandling";

// En upphandling är en inbjudan från en köpare till bolag den själv valt ut.
// Den skickas och besvaras precis som en förfrågan från Rekrytera: den granskas,
// bolagen accepterar eller tackar nej på Mina sidor, och köparens namn och
// kontaktuppgifter låses upp först vid accept. Skillnaden är innehållet — flera
// orter och yrkesområden, kompetenser, krav, avtalstid och volym — som sparas i
// inquiries.upphandling (supabase/migration_upphandling_inbjudan.sql).
//
// Reglerna ligger här, utan databas och mejl, så att formuläret och routen
// läser samma gränser.

export const MAX_BOLAG = 60;
export const FORVALDA_BOLAG = 10;
export const VARNA_VID_BOLAG = 15;
export const MAX_BESKRIVNING = 1500;

// Kraven är kryssrutor. Alla kan läsas i bolagens profiler utom
// ansvarsförsäkringen, som bolaget får svara på när det accepterat.
export const KRAV_VAL = KRAV_MALL.map(({ id, text, profil }) => ({ id, text, profil }));

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function valfriText(v, max) {
  return v === undefined || v === null || (typeof v === "string" && v.length <= max);
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

// Upphandlingen som text, för den som saknar kolumnen (migrationen inte körd)
// och för mejlen. Samma uppgifter som rutan på Mina sidor.
export function upphandlingSomText(u) {
  return [
    `Orter: ${u.orter.join(", ")}`,
    `Yrkesområden: ${u.omraden.join(", ")}`,
    u.kompetenser.length ? `Kompetenser: ${u.kompetenser.join(", ")}` : null,
    u.krav.length ? `Krav: ${u.krav.join(", ")}` : null,
    u.ovrigaKrav ? `Övriga krav: ${u.ovrigaKrav}` : null,
    u.avtalstid ? `Avtalstid: ${u.avtalstid}` : null,
    u.volym ? `Volym: ${u.volym}` : null,
    u.svaraSenast ? `Svar önskas senast: ${u.svaraSenast}` : null,
    `Köpare: ${u.kopare}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Allt som skickas in, kontrollerat. Returnerar { fel } med något som går att
// visa för köparen, eller det routen behöver för att spara.
export function valideraInbjudan(b = {}) {
  if (!GILTIGA_TJANSTER.has(b.tjanst)) return { fel: "Välj en tjänst." };

  if (
    !Array.isArray(b.omraden) ||
    !b.omraden.length ||
    b.omraden.length > MAX_OMRADEN ||
    !b.omraden.every((o) => Object.hasOwn(YRKESOMRADEN, o))
  ) {
    return { fel: `Välj mellan 1 och ${MAX_OMRADEN} yrkesområden.` };
  }
  const omraden = [...new Set(b.omraden)];

  if (!Array.isArray(b.orter)) return { fel: "Lägg till minst en ort." };
  const orter = unika(b.orter.map(kanoniskOrt).filter(Boolean));
  if (orter.length !== b.orter.length) return { fel: "Orterna måste vara svenska kommuner och får bara anges en gång." };
  if (!orter.length || orter.length > MAX_ORTER) return { fel: `Ange mellan 1 och ${MAX_ORTER} orter.` };

  const rakompetenser = Array.isArray(b.kompetenser) ? b.kompetenser : [];
  if (!rakompetenser.every((k) => text(k, 40)) || rakompetenser.length > MAX_KOMPETENSER) {
    return { fel: `Ange högst ${MAX_KOMPETENSER} kompetenser på högst 40 tecken.` };
  }
  const kompetenser = unika(rakompetenser.map((k) => k.trim()));

  const kravIds = Array.isArray(b.krav) ? b.krav : [];
  const krav = KRAV_VAL.filter((k) => kravIds.includes(k.id)).map((k) => k.text);
  if (krav.length !== new Set(kravIds).size) return { fel: "Kontrollera kraven." };
  if (!valfriText(b.ovrigaKrav, 300)) return { fel: "Övriga krav får vara högst 300 tecken." };

  if (!text(b.titel, 80)) return { fel: "Ange en rubrik på högst 80 tecken." };
  if (!text(b.kopare, 120)) return { fel: "Beskriv er verksamhet med högst 120 tecken." };
  if (!text(b.beskrivning, MAX_BESKRIVNING)) return { fel: "Beskriv upphandlingen med högst 1 500 tecken." };
  if (!valfriText(b.avtalstid, 80) || !valfriText(b.volym, 120)) return { fel: "Avtalstid eller volym är för lång." };
  if (b.svaraSenast && (!DATUM_RE.test(b.svaraSenast) || b.svaraSenast < idag())) {
    return { fel: "Datumet för svar har redan passerat." };
  }

  const companyIds = Array.isArray(b.companyIds) ? [...new Set(b.companyIds)] : [];
  if (!companyIds.length || companyIds.length > MAX_BOLAG || !companyIds.every((id) => Number.isInteger(id) && id > 0)) {
    return { fel: `Välj mellan 1 och ${MAX_BOLAG} bolag att bjuda in.` };
  }

  const k = b.kontakt || {};
  if (!valideraKontakt(k)) return { fel: "Fyll i alla kontaktuppgifter." };

  const upphandling = {
    titel: b.titel.trim(),
    kopare: b.kopare.trim(),
    orter,
    omraden,
    kompetenser,
    krav,
    ovrigaKrav: b.ovrigaKrav?.trim() || null,
    avtalstid: b.avtalstid?.trim() || null,
    volym: b.volym?.trim() || null,
    svaraSenast: b.svaraSenast || null,
  };
  const beskrivning = b.beskrivning.trim();

  // Förfrågans vanliga kolumner fylls så att allt som redan läser förfrågningar
  // — Mina sidor, granskningen, mejlen, uppföljningen och routningen till
  // betalda kontor — fungerar utan ändring. Rubriken blir det bolagen ser som
  // rubrik, och den första orten styr routningen.
  const rad = {
    search_role: upphandling.titel,
    focus_area: omraden[0],
    service: b.tjanst,
    city: orter[0],
    region: regionForCity(orter[0]) || null,
    description: beskrivning,
    requester_name: k.namn.trim(),
    requester_email: k.epost.trim(),
    requester_website: k.webbplats.trim(),
    requester_role: k.roll.trim(),
    requester_company: k.foretag.trim(),
    requester_city: k.ort.trim(),
    requester_phone: k.telefon?.trim() || null,
  };

  return {
    rad,
    companyIds,
    extra: { upphandling },
    reserv: { description: `${beskrivning}\n\n${upphandlingSomText(upphandling)}` },
    mejl: {
      requesterName: rad.requester_name,
      requesterEmail: rad.requester_email,
      requesterRole: rad.requester_role,
      requesterCompany: rad.requester_company,
      requesterCity: rad.requester_city,
      requesterWebsite: rad.requester_website,
      requesterPhone: rad.requester_phone || "",
      region: rad.region || "",
      description: `${beskrivning}\n\n${upphandlingSomText(upphandling)}`,
      searchRole: upphandling.titel,
      focusArea: omraden.join(", "),
      service: b.tjanst,
    },
  };
}
