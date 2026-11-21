// Gränserna för en upphandling, utan databas och utan mejl, så att formuläret
// och routerna läser samma tak. Ett tak som bara finns i formuläret blir ett
// formulär som släpper igenom något servern avvisar, eller tvärtom. Reglerna
// för själva inbjudan ligger i lib/upphandlingInbjudan.js.
export const MAX_ORTER = 12;
export const MAX_KOMPETENSER = 8;
export const MAX_OMRADEN = 5;

// Färdiga krav. `profil` säger att svaret går att läsa ur bolagets profil, så
// att köparen ser vilka bolag som uppfyller det redan i listan.
export const KRAV_MALL = [
  { id: "kollektivavtal", text: "Kollektivavtal eller motsvarande villkor", niva: "ska", profil: "ka" },
  { id: "forsakring", text: "Ansvarsförsäkring", niva: "ska", profil: null },
  { id: "iso9001", text: "ISO 9001", niva: "bor", profil: "ISO 9001" },
  { id: "iso14001", text: "ISO 14001", niva: "bor", profil: "ISO 14001" },
  { id: "auktorisation", text: "Auktoriserad av Kompetensföretagen", niva: "bor", profil: "auktorisation" },
];

const EPOST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function valfriText(v, max) {
  return v === undefined || v === null || (typeof v === "string" && v.length <= max);
}

// Dagens datum i Sverige, så att ett datum i tidplanen gäller hela dagen även
// kring midnatt UTC.
export function idag() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

export function valideraKontakt(b) {
  return (
    text(b.namn, 100) &&
    typeof b.epost === "string" &&
    EPOST_RE.test(b.epost.trim()) &&
    b.epost.length <= 254 &&
    text(b.webbplats, 200) &&
    text(b.roll, 100) &&
    text(b.foretag, 200) &&
    text(b.ort, 100) &&
    valfriText(b.telefon, 30)
  );
}
