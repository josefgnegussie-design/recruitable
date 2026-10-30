// "Tillbaka till sökningen" på en profil ska ta besökaren tillbaka till samma
// träfflista, med filter och scrollläge kvar, när det var därifrån hen kom.
// Next navigerar på klientsidan, så document.referrer säger inget om föregående
// sida. I stället märks profilen när den öppnas från en träfflista, och
// märkningen gäller bara just den profilen.
const NYCKEL = "recruitable:fran-traffar";

export function markeraFranTraffar(href) {
  try {
    window.sessionStorage.setItem(NYCKEL, href);
  } catch {
    // Privat läge eller full kvot — då leder länken till /rekrytera i stället.
  }
}

export function kommerFranTraffar(pathname) {
  try {
    return window.sessionStorage.getItem(NYCKEL) === pathname;
  } catch {
    return false;
  }
}
