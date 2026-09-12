// Adressvänligt namn för ett bolag: "Jovi Konsult AB" blir "jovi-konsult".
//
// En enda implementation, använd av både backfyllningen (scripts/bygg-slugar.mjs)
// och av godkännandet som skapar nya bolag. Två uppsättningar regler hade gett
// olika slugar för samma namn beroende på vilken väg bolaget kom in.

// Bolagsformen säger ingenting om vilket bolag det är och gör varje adress
// längre. Den kapas bara i slutet — "AB Hyrpersonal" behåller sitt AB, eftersom
// det där är en del av namnet.
const BOLAGSFORMER = /-(ab|hb|kb|ekon-foren|ek-for)$/;

export function slugga(namn) {
  const bas = (namn || "")
    .toLowerCase()
    // Svenska vokaler translittereras medvetet till a och o i stället för att
    // strippas: "Växjö" ska bli "vaxjo" och inte "vxj".
    .replace(/[àáâãä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[å]/g, "a")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/&/g, " och ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const utanForm = bas.replace(BOLAGSFORMER, "");

  // Blir det tomt — ett namn helt utan latinska tecken — är det bättre att
  // falla tillbaka på något än att spara en tom sträng i en unik kolumn.
  return utanForm || bas || "";
}

// Slug som garanterat inte krockar med en redan tagen. Siffran hängs på i
// stället för att slugen ändras i grunden, så adressen fortfarande går att läsa.
export function unikSlug(namn, upptagna, fallbackId) {
  const bas = slugga(namn) || `bolag-${fallbackId}`;
  if (!upptagna.has(bas)) return bas;

  for (let i = 2; i < 1000; i++) {
    const kandidat = `${bas}-${i}`;
    if (!upptagna.has(kandidat)) return kandidat;
  }

  return `${bas}-${fallbackId}`;
}

// Är parametern i /bolag/[id] ett id eller en slug? Avgörs på formen, så att
// uppslaget blir en fråga och inte två försök.
export function arId(param) {
  return /^\d+$/.test(String(param || ""));
}

// Adressen till en bolagsprofil. Faller tillbaka på id:t när slugen saknas —
// ett bolag som just skapats innan backfyllningen hunnit köra, eller en rad ur
// den statiska reservfilen. Routen skickar då vidare till slugen så fort den
// finns, så länken går aldrig sönder.
export function bolagsUrl(bolag) {
  return `/bolag/${bolag?.slug || bolag?.id}`;
}
