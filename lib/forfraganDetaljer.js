// Antal personer och önskad start på en förfrågan. Delas av AI-sökningen, som
// tolkar dem ur fritext, förfrågans steg 2, där köparen kan ändra dem, och
// routen som sparar förfrågan och kontrollerar dem en gång till.

const MANADER = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December",
];

export const SNARAST = "Snarast";
export const MAX_ANTAL = 500;

// "Snarast" och de kommande tolv månaderna, med innevarande månad först.
export function startAlternativ(nu = new Date()) {
  const ut = [SNARAST];
  for (let i = 0; i < 12; i++) {
    const d = new Date(nu.getFullYear(), nu.getMonth() + i, 1);
    ut.push(`${MANADER[d.getMonth()]} ${d.getFullYear()}`);
  }
  return ut;
}

// Servern tar emot alla månader på formen "Mars 2027", inte bara de tolv som
// listan visar just nu: en sida som stått öppen över ett månadsskifte ska inte
// få sin förfrågan avvisad.
const START_RE = new RegExp(`^(${SNARAST}|(${MANADER.join("|")}) 20\\d\\d)$`);
export function giltigStart(v) {
  return typeof v === "string" && START_RE.test(v);
}

// Ett heltal 1–MAX_ANTAL, eller null.
export function tolkaAntal(v) {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").trim(), 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_ANTAL ? n : null;
}

// Etiketterna som bolagen ser, t.ex. ["2 personer", "Start januari 2027"].
export function detaljEtiketter({ antal, start }) {
  const ut = [];
  if (antal) ut.push(antal === 1 ? "1 person" : `${antal} personer`);
  if (start) ut.push(start === SNARAST ? "Start snarast" : `Start ${start.toLowerCase()}`);
  return ut;
}
