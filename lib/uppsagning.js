// Skälen till en uppsägning, som fast lista.
//
// Fritext hade gett tjugo olika formuleringar av samma sak och ingenting att
// räkna på. Med en fast lista går svaren att summera: är det priset, är det
// antalet förfrågningar, eller är det att de inte passar? Tre olika problem med
// tre olika åtgärder, och utan siffror går det inte att veta vilket man har.
//
// Listan delas av formuläret och routen, så ett skäl som inte står här går inte
// heller att spara.
export const UPPSAGNINGSSKAL = [
  { varde: "for_dyrt", etikett: "För dyrt i förhållande till vad vi får ut" },
  { varde: "for_fa", etikett: "Vi får för få förfrågningar" },
  { varde: "passar_inte", etikett: "Förfrågningarna passar inte vår inriktning" },
  { varde: "hinner_inte", etikett: "Vi hinner inte svara på dem" },
  { varde: "inget_behov", etikett: "Vi har inget rekryteringsbehov just nu" },
  { varde: "annan_kanal", etikett: "Vi använder en annan kanal i stället" },
  { varde: "verksamheten_upphor", etikett: "Verksamheten upphör eller har slagits ihop" },
  { varde: "annat", etikett: "Något annat" },
];

export const GILTIGA_SKAL = new Set(UPPSAGNINGSSKAL.map((s) => s.varde));

export function etikettForSkal(varde) {
  return UPPSAGNINGSSKAL.find((s) => s.varde === varde)?.etikett || varde;
}
