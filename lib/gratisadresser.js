// Gratistjänster för e-post. En adress hos dem säger inget om vilket företag
// avsändaren hör till, så förfrågningsformulärets domänkontroll kan aldrig gå
// igenom med en sådan. Listan finns för att kunna säga det i klartext direkt,
// i stället för det allmänna "måste matcha er webbplats" när man trycker
// Skicka. Den är inte uttömmande och behöver inte vara det: serverns
// domänkontroll i /api/forfragan/skicka är densamma som förut.
//
// Operatörsdomäner som telia.com står inte med: de är också operatörernas egna
// företagsadresser, och deras anställda ska kunna skicka förfrågningar.
export const GRATISDOMANER = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.se",
  "outlook.com",
  "outlook.se",
  "live.com",
  "live.se",
  "msn.com",
  "yahoo.com",
  "yahoo.se",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.se",
  "mail.com",
  "spray.se",
]);

export function arGratisadress(doman) {
  return GRATISDOMANER.has(String(doman || "").toLowerCase());
}
