// Reglerna för när ett konto får ta över ett bolag utan granskning. Filen delas
// av formuläret, som ger besked direkt, och av servern, som avgör. Inga
// beroenden, så att reglerna kan provas utan resten av appen.

// Domänen i en webbadress, utan www.
export function domanUrWebbadress(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const medProtokoll = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    return new URL(medProtokoll).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function domanUrEpost(epost) {
  return String(epost || "").trim().split("@")[1]?.toLowerCase() || null;
}

// Domäner som många delar. En adress där bevisar ingenting om vem man jobbar
// hos, och en webbplats där säger inte vems domänen är: bolag med en sida på
// facebook.com eller wixsite.com ska aldrig matcha någon automatiskt.
const DELADE_DOMANER = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.se",
  "outlook.com",
  "outlook.se",
  "live.com",
  "live.se",
  "msn.com",
  "icloud.com",
  "me.com",
  "yahoo.com",
  "yahoo.se",
  "proton.me",
  "protonmail.com",
  "telia.com",
  "spray.se",
  "bredband.net",
  "comhem.se",
  "tele2.se",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "allabolag.se",
  "hitta.se",
  "eniro.se",
  "wixsite.com",
  "wordpress.com",
  "squarespace.com",
  "one.com",
  "webnode.se",
  "google.com",
  "sites.google.com",
]);

function arDelad(doman) {
  return [...DELADE_DOMANER].some((d) => doman === d || doman.endsWith(`.${d}`));
}

// Bolagets domän ur webbplatsen i registret, eller null om den inte går att
// lita på. Null betyder att ansökan måste granskas av en människa.
export function bolagsdoman(webbadress) {
  const doman = domanUrWebbadress(webbadress);
  return doman && doman.includes(".") && !arDelad(doman) ? doman : null;
}

// Hör adressen till bolaget? Exakt samma domän, eller en underdomän åt något
// håll: anna@se.bolaget.com hör till bolaget.com, och webbplatsen
// karriar.bolaget.se hör till anna@bolaget.se. Bindningen sker i slutet av
// domänen, så bolaget.se.angripare.com matchar aldrig bolaget.se.
export function domanMatchar(epost, webbadress) {
  const bolagets = bolagsdoman(webbadress);
  const adressens = domanUrEpost(epost);
  if (!bolagets || !adressens || arDelad(adressens)) return false;
  return (
    adressens === bolagets || adressens.endsWith(`.${bolagets}`) || bolagets.endsWith(`.${adressens}`)
  );
}

// Går bolaget att ta över över huvud taget? Ett övertaget bolag kräver en
// inbjudan från den som redan administrerar det, ett upphört har ingen
// verksamhet kvar. Texterna visas både i formuläret och som svar från servern.
export function hinderForOvertagande(bolag) {
  if (bolag?.upphort) {
    return { kod: "upphort", text: "Bolaget är inte längre verksamt i registret och kan inte tas över." };
  }
  if (bolag?.claimed) {
    return {
      kod: "overtaget",
      text: "Bolaget administreras redan. Be en kollega som har tillgång att bjuda in dig under Konto på Mina sidor. Vet ni inte vem det är, mejla info@recruitable.se.",
    };
  }
  return null;
}

// Avgörandet: "automatisk" aktiveras när mejladressen är bekräftad, "granskning"
// går till kön. Ett nytt bolag och ett utan användbar webbplats kan bara
// granskas. Stämmer adressen inte får personen ett besked och väljer själv om
// ansökan ska granskas, så att ett skrivfel i adressen inte ligger i kön.
export function bedomOvertagande({ epost, bolag, manuell }) {
  if (!bolag) return { lage: "granskning" };
  if (domanMatchar(epost, bolag.link)) return { lage: "automatisk" };
  if (!bolagsdoman(bolag.link) || manuell) return { lage: "granskning" };
  return { lage: "fel_doman", doman: bolagsdoman(bolag.link) };
}
