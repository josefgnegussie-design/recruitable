// Nyckeltalen finns i två uppsättningar, och det är hela poängen.
//
// companies.revenue/revenue_year/employees/employees_year/founded är REGISTRETS
// tal: hämtade ur Bolagsverket och årsredovisningar, aldrig skrivna av ett bolag.
// company_key_figures är bolagets egna, skrivna på Mina sidor.
//
// Profilen visar bolagets tal överst och registrets under som jämförelsetal. Den
// som inte rört en uppgift har inget eget tal, och då står registrets ensamt.
//
// Varför inte skriva över registrets kolumn: köparen jämför bolag med varandra,
// och en siffra bolaget skrivit själv är inte samma sorts uppgift som en
// reviderad. Står båda kvar behåller jämförelsen sitt ankare. Dessutom skulle en
// överskrivning förstöra uppgiften för gott — vi kunde inte ens fylla på med
// nästa årsredovisning utan att radera bolagets egen siffra.

// Uppgifterna bolaget får skriva. `ar` är fältet med räkenskapsåret där ett
// sådant hör till; grundat är ett årtal i sig och har inget eget år.
//
// registerAr anges i båda stavningarna eftersom de två anroparna ger oss olika
// former av samma rad: profilsidan får den genom fromRow i companiesRepo, som
// översätter till camelCase, medan Mina sidor läser raden rå ur databasen med
// snake_case. Att bara hantera den ena betyder att årtalet tyst försvinner på
// den andra — vilket det gjorde, tills en förhandsvisning råkade visa det.
export const EGNA_NYCKELTAL = [
  { nyckel: "revenue", ar: "revenue_year", registerFalt: "revenue", registerAr: ["revenue_year", "revenueYear"] },
  {
    nyckel: "employees",
    ar: "employees_year",
    registerFalt: "employees",
    registerAr: ["employees_year", "employeesYear"],
  },
  { nyckel: "founded", ar: null, registerFalt: "founded", registerAr: null },
];

// Ett årtal ska vara ett årtal. Nedre gränsen är godtycklig men inte orimlig,
// och den övre släpper igenom nästa år eftersom ett räkenskapsår kan rapporteras
// i förskott.
export function giltigtArtal(v) {
  if (v === null || v === undefined || v === "") return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1800 && n <= new Date().getFullYear() + 1;
}

// Omsättning och medarbetare är fritext med flit: källorna skriver dem olika
// ("221,2 Mkr", "1 997 Mkr (koncern)", "301"), och att tvinga in dem i ett tal
// skulle antingen kasta bort koncernparentesen eller avvisa en sann uppgift.
export function giltigtNyckeltal(v, max = 60) {
  return v === null || v === undefined || (typeof v === "string" && v.length <= max);
}

function tomt(v) {
  return v === null || v === undefined || v === "";
}

function taltill(v) {
  return tomt(v) ? null : Number(v);
}

// Bygger bolagets egna nyckeltal ur det formuläret skickat.
//
// Ett fält som rensats försvinner ur objektet i stället för att sparas som null
// — då faller profilen tillbaka på registrets tal, vilket är precis vad bolaget
// bett om genom att tömma fältet.
//
// Datumet sätts bara när uppgiften faktiskt ändrats. Den som sparar profilen
// utan att röra siffrorna ska inte få dem omdaterade; datumet skulle då ljuga om
// när uppgiften senast stämde.
export function byggEgnaNyckeltal(tidigare, inkommande) {
  const fore = tidigare && typeof tidigare === "object" ? tidigare : {};
  const nu = new Date().toISOString().slice(0, 10);
  const ut = {};

  for (const { nyckel, ar } of EGNA_NYCKELTAL) {
    const vardeIn = inkommande[nyckel];
    const arIn = ar ? inkommande[ar] : undefined;

    const varde =
      nyckel === "founded" ? taltill(vardeIn) : tomt(vardeIn) ? null : String(vardeIn).trim() || null;
    const arVarde = ar ? taltill(arIn) : null;

    // Tomt fält betyder "använd registrets tal igen".
    if (varde === null) continue;

    const oforandrat =
      String(fore[nyckel] ?? "") === String(varde ?? "") &&
      (!ar || String(fore[ar] ?? "") === String(arVarde ?? ""));

    ut[nyckel] = varde;
    if (ar && arVarde !== null) ut[ar] = arVarde;
    ut[`${nyckel}_updated`] = oforandrat ? fore[`${nyckel}_updated`] || nu : nu;
  }

  return ut;
}

// Vad profilen ska visa för en uppgift: bolagets tal om det finns, annars
// registrets — plus registrets tal separat när båda finns, så att det kan ställas
// under som jämförelse.
export function nyckeltal(company, nyckel) {
  const def = EGNA_NYCKELTAL.find((n) => n.nyckel === nyckel);
  if (!def) return null;

  const egna = company?.companyKeyFigures ?? company?.company_key_figures ?? {};
  const registerVarde = company?.[def.registerFalt] ?? null;
  const registerAr = (def.registerAr ?? []).map((f) => company?.[f]).find((v) => !tomt(v)) ?? null;

  const egetVarde = egna[nyckel] ?? null;
  const egetAr = def.ar ? egna[def.ar] ?? null : null;
  const franBolaget = !tomt(egetVarde);

  return {
    varde: franBolaget ? egetVarde : registerVarde,
    ar: franBolaget ? egetAr : registerAr,
    franBolaget,
    uppdaterad: franBolaget ? egna[`${nyckel}_updated`] ?? null : null,
    // Jämförelsetalet. Bara när bolaget lämnat ett eget OCH registret har ett —
    // annars finns ingenting att jämföra med, och raden vore brus.
    jamforelse: franBolaget && !tomt(registerVarde) ? { varde: registerVarde, ar: registerAr } : null,
  };
}
