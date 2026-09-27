// Nyckeltalen bolaget själv får skriva efter att ha tagit över profilen.
//
// Omsättning och medarbetare är fritext med flit: källorna skriver dem olika
// ("221,2 Mkr", "1 997 Mkr (koncern)", "301"), och att tvinga in dem i ett tal
// skulle antingen kasta bort koncernparentesen eller avvisa en sann uppgift.
// Året däremot är ett årtal, och det är året som gör siffran jämförbar.
export const NYCKELTAL = ["revenue", "revenueYear", "employees", "employeesYear", "founded"];

// Kolumnnamnet i companies för varje fält formuläret skickar.
export const NYCKELTALSKOLUMN = {
  revenue: "revenue",
  revenueYear: "revenue_year",
  employees: "employees",
  employeesYear: "employees_year",
  founded: "founded",
};

// Fälten som hör ihop i profilens källmärkning: årtalet är inte en egen uppgift
// utan en del av siffran det gäller.
export const NYCKELTALSGRUPP = {
  revenue: ["revenue", "revenueYear"],
  employees: ["employees", "employeesYear"],
  founded: ["founded"],
};

const NU = () => new Date().toISOString().slice(0, 10);

// Ett årtal ska vara ett årtal. Nedre gränsen är godtycklig men inte orimlig —
// äldre svenska bolag finns, men inte i den här branschen — och den övre släpper
// igenom nästa år, eftersom ett räkenskapsår kan rapporteras i förskott.
export function giltigtArtal(v) {
  if (v === null || v === undefined || v === "") return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1800 && n <= new Date().getFullYear() + 1;
}

export function giltigtNyckeltal(v, max = 60) {
  return v === null || v === undefined || (typeof v === "string" && v.length <= max);
}

// Vilka nyckeltal bolaget faktiskt ändrade, och när. Bara fält som fått ett nytt
// värde märks — den som sparar profilen utan att röra siffrorna ska inte få dem
// omstämplade som sina egna, för då skulle datumet ljuga om när uppgiften
// senast kontrollerades.
export function markeraAndrade(tidigare, nuvarande, inkommande) {
  const marken = { ...(tidigare && typeof tidigare === "object" ? tidigare : {}) };
  const datum = NU();

  for (const [grupp, falt] of Object.entries(NYCKELTALSGRUPP)) {
    const andrat = falt.some((f) => {
      const kolumn = NYCKELTALSKOLUMN[f];
      const nytt = inkommande[f] ?? null;
      const gammalt = nuvarande?.[kolumn] ?? null;
      // Jämför som text: 2024 och "2024" är samma uppgift för en människa.
      return String(nytt ?? "") !== String(gammalt ?? "");
    });
    if (andrat) marken[grupp] = datum;
  }

  return marken;
}
