// GFL (Genomsnittligt förtjänstläge) enligt bemanningsavtalets § 5-metodik (Kompetensföretagen/Almega).
// T/P/Övriga = kr/månad, Arbetstid = timmar/vecka, Förkortning = minuter/vecka. Standardvecka 40h, 4,35 veckor/månad.
export function computeGFL(t, p, o, a, f) {
  t = parseFloat(String(t).replace(",", "."));
  p = parseFloat(String(p).replace(",", "."));
  o = parseFloat(String(o).replace(",", "."));
  a = parseFloat(String(a).replace(",", "."));
  f = parseFloat(String(f).replace(",", "."));
  if ([t, p, o, a, f].some((v) => isNaN(v)) || a <= 0) return null;
  const D = 40 * 4.35;
  const tPerH = t / D;
  const pPerH = p / D;
  const oPerH = o / (a * 4.35);
  const skift = (t + p) * (40 - a) / (a * D);
  const delsumma = tPerH + pPerH + oPerH + skift;
  const forkPerH = delsumma * (f / 60) / a;
  const summa = delsumma + forkPerH;
  return { tPerH, pPerH, oPerH, skift, forkPerH, summa };
}
