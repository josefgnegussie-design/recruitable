import { regionForCity } from "@/lib/helpers";
import { GILTIGA_TJANSTER, YRKESOMRADEN } from "@/lib/taxonomy";
import { idag, KRAV_MALL, MAX_KOMPETENSER, MAX_OMRADEN, MAX_ORTER, valideraKontakt } from "@/lib/upphandling";

// En upphandling är en inbjudan från en köpare till bolag den själv valt ut.
// Den skickas och besvaras precis som en förfrågan från Rekrytera: den granskas,
// bolagen accepterar eller tackar nej på Mina sidor, och köparens namn och
// kontaktuppgifter låses upp först vid accept. Skillnaden är innehållet — ett
// eller flera arbetsställen, yrkesområden, kompetenser, krav, avtalstid, volym
// och tidplan — som sparas i
// inquiries.upphandling (supabase/migration_upphandling_inbjudan.sql).
//
// Reglerna ligger här, utan databas och mejl, så att formuläret och routen
// läser samma gränser. Postnummerregistret hör till servern och kommer in som
// en funktion (lib/arbetsstalle.js), så att formuläret inte drar med sig det.

export const MAX_BOLAG = 60;
export const FORVALDA_BOLAG = 10;
export const FORVALDA_PER_ARBETSSTALLE = 5;
export const VARNA_VID_BOLAG = 15;

// De förvalda bolagen. Med ett arbetsställe de tio översta. Med flera fem nya
// för varje arbetsställe, de närmaste just det arbetsstället, så att lokala
// bolag vid varje plats kommer med och inte trängs undan av bolag som når alla
// platserna och därför rankas högst. Vid lika avstånd gäller den vanliga
// ordningen. Ett bolag som redan valts för en plats räknas inte igen.
export function forvaldaBolag(bolag, perOrt) {
  if (perOrt.length <= 1) return bolag.slice(0, FORVALDA_BOLAG).map((b) => b.id);
  const valda = new Set();
  for (const { ort } of perOrt) {
    bolag
      .map((b, rang) => ({ id: b.id, rang, km: b.tackning.find((t) => t.ort === ort)?.km }))
      .filter((b) => b.km !== undefined && !valda.has(b.id))
      .sort((a, b) => a.km - b.km || a.rang - b.rang)
      .slice(0, FORVALDA_PER_ARBETSSTALLE)
      .forEach((b) => valda.add(b.id));
  }
  return bolag.filter((b) => valda.has(b.id)).map((b) => b.id);
}

// Varningen för många inbjudna växer med antalet arbetsställen: två platser
// behöver fler bolag än en.
export function varnaVidBolag(antalArbetsstallen) {
  return Math.min(MAX_BOLAG, VARNA_VID_BOLAG * Math.max(1, antalArbetsstallen));
}
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

export function formateraDatum(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}

// Arbetsstället som text. Gatuadressen bara när den får synas: för köparen
// själv, för granskaren och för ett bolag som accepterat.
export function arbetsstalleText(a, medAdress) {
  const ort = `${a.postnummer} ${a.postort}`;
  return medAdress && a.adress ? `${a.adress}, ${ort}` : ort;
}

// Tidplanen i den ordning den inträffar. Tom om köparen inte angett något.
export function tidplanRader(u) {
  return [
    ["Svar önskas senast", u.svaraSenast],
    ["Besked till bolagen", u.beskedSenast],
    ["Planerad start", u.startdatum],
  ].filter(([, v]) => v);
}

// Upphandlingen som text, för den som saknar kolumnen (migrationen inte körd)
// och för mejlen. Samma uppgifter som rutan på Mina sidor. Texten utan adress
// är den som kan hamna i description och därmed synas före accept.
export function upphandlingSomText(u, { medAdress = false } = {}) {
  return [
    u.arbetsstallen?.length
      ? `Arbetsställen: ${u.arbetsstallen.map((a) => arbetsstalleText(a, medAdress)).join("; ")}`
      : `Orter: ${u.orter.join(", ")}`,
    `Yrkesområden: ${u.omraden.join(", ")}`,
    u.kompetenser.length ? `Kompetenser: ${u.kompetenser.join(", ")}` : null,
    u.krav.length ? `Krav: ${u.krav.join(", ")}` : null,
    u.ovrigaKrav ? `Övriga krav: ${u.ovrigaKrav}` : null,
    u.avtalstid ? `Avtalstid: ${u.avtalstid}` : null,
    u.volym ? `Volym: ${u.volym}` : null,
    ...tidplanRader(u).map(([k, v]) => `${k}: ${formateraDatum(v)}`),
    `Köpare: ${u.kopare}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Allt som skickas in, kontrollerat. Returnerar { fel } med något som går att
// visa för köparen, eller det routen behöver för att spara.
// `tolkaArbetsstalle` är arbetsstalleFran ur lib/arbetsstalle.js.
export function valideraInbjudan(b = {}, tolkaArbetsstalle) {
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

  if (!Array.isArray(b.arbetsstallen) || !b.arbetsstallen.length || b.arbetsstallen.length > MAX_ORTER) {
    return { fel: `Ange mellan 1 och ${MAX_ORTER} arbetsställen.` };
  }
  const tolkade = b.arbetsstallen.map(tolkaArbetsstalle);
  if (tolkade.some((a) => !a)) return { fel: "Kontrollera arbetsställenas adresser och postnummer." };
  if (tolkade.some((a) => !a.adress)) return { fel: "Ange gatuadress för varje arbetsställe." };
  const arbetsstallen = tolkade.map(({ adress, postnummer, postort, kommun }) => ({ adress, postnummer, postort, kommun }));
  const nycklar = arbetsstallen.map((a) => `${a.adress}|${a.postnummer}`.toLowerCase());
  if (new Set(nycklar).size !== nycklar.length) return { fel: "Samma arbetsställe står med två gånger." };
  const orter = unika(arbetsstallen.map((a) => a.kommun).filter(Boolean));

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
  const datum = { svaraSenast: b.svaraSenast || null, beskedSenast: b.beskedSenast || null, startdatum: b.startdatum || null };
  for (const v of Object.values(datum)) {
    if (v && (typeof v !== "string" || !DATUM_RE.test(v))) return { fel: "Kontrollera datumen i tidplanen." };
    if (v && v < idag()) return { fel: "Ett datum i tidplanen har redan passerat." };
  }
  const iOrdning = [datum.svaraSenast, datum.beskedSenast, datum.startdatum].filter(Boolean);
  if (iOrdning.some((v, i) => i > 0 && v < iOrdning[i - 1])) {
    return { fel: "Tidplanen ska gå framåt: svar, sedan besked, sedan start." };
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
    arbetsstallen,
    // Kommunerna, för den som bara läser orter (och för äldre inbjudningar).
    orter,
    omraden,
    kompetenser,
    krav,
    ovrigaKrav: b.ovrigaKrav?.trim() || null,
    avtalstid: b.avtalstid?.trim() || null,
    volym: b.volym?.trim() || null,
    ...datum,
    // Får visas som en anonym mening bland pågående upphandlingar på
    // /upphandling (lib/pagaendeUpphandlingar.js). Bara på köparens uttryckliga ja.
    visaSomExempel: b.visaSomExempel === true,
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
    // description syns för bolaget före accept, så gatuadressen står inte där.
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
      description: `${beskrivning}\n\n${upphandlingSomText(upphandling, { medAdress: true })}`,
      searchRole: upphandling.titel,
      focusArea: omraden.join(", "),
      service: b.tjanst,
    },
  };
}
