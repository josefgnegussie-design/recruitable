import { sverigePrickar } from "@/lib/postnummer";

// Karta över var bolaget finns. Serverkomponent med rent SVG — ingen
// kartleverantör, inga rutor att hämta, ingen nyckel att förvalta och inget
// skript i webbläsaren. Landet ritas som prickar ur postnummerregistret
// (se sverigePrickar), kontoren som nålar ovanpå.
//
// Prickarna är en silhuett av var folk bor, inte en gränslinje: Norrlands
// inland är glest för att det ÄR glest. En riktig kartbild hade krävt antingen
// en extern tjänst eller en geometrifil på ett par hundra kilobyte, och båda är
// stor apparat för en orienteringsbild i en sidospalt.

// Utsnittet: hela landet med en marginal, så att en nål i Kiruna eller Trelleborg
// inte hamnar i kanten.
const LAT_MAX = 68.9;
const LAT_MIN = 55.1;
const LNG_MIN = 10.8;
const LNG_MAX = 24.4;

// Längdgrader krymper mot polerna. Utan den här faktorn blir Sverige dubbelt så
// brett som det är — kartan ska se ut som landet, inte som en utdragen rektangel.
const KX = Math.cos((62 * Math.PI) / 180);
const SKALA = 20;

const MARGINAL = 6;
// Ortnamnen står till höger om sin nål, alltså delvis utanför landet. Hur långt
// utanför beror på bolaget — ett kontor i Haparanda skjuter ut namnet längre än
// ett i Malmö — så utsnittet räknas fram per bolag i stället för att alltid
// lämna plats åt det längsta tänkbara namnet. Monospace: varje tecken är lika
// brett, och 0,6 em av teckenstorleken nedan.
const TECKENBREDD = 4.3;

const BREDD = (LNG_MAX - LNG_MIN) * KX * SKALA;
const HOJD = (LAT_MAX - LAT_MIN) * SKALA;

const x = (lng) => MARGINAL + (lng - LNG_MIN) * KX * SKALA;
const y = (lat) => MARGINAL + (LAT_MAX - lat) * SKALA;

// En prick per bebodd ruta, ritad som ett streck utan längd med rund ände —
// billigare i uppmärkning än lika många <circle>, och tusen prickar ska inte
// kosta trettio kilobyte HTML.
function landPath() {
  return sverigePrickar()
    .map(([lat, lng]) => `M${x(lng).toFixed(1)} ${y(lat).toFixed(1)}h.1`)
    .join("");
}

export default function Sverigekarta({ pinnar = [], namn }) {
  if (!pinnar.length) return null;

  // Etiketterna skrivs uppifrån och ner, och en som hamnar för nära den
  // föregående knuffas ner. Utan det lade Göteborg och Falkenberg sina namn i
  // varandra — åtta mil isär i verkligheten, nio bildpunkter här.
  const etiketter = [];
  let senast = -Infinity;
  for (const p of [...pinnar].sort((a, b) => b.lat - a.lat)) {
    const yt = Math.max(y(p.lat), senast + 9);
    senast = yt;
    etiketter.push({ ...p, yt });
  }

  const orter = pinnar.map((p) => p.namn).join(", ");
  const hogerkant = Math.max(
    BREDD + MARGINAL * 2,
    ...etiketter.map((p) => x(p.lng) + 8.5 + p.namn.length * TECKENBREDD + MARGINAL)
  );

  return (
    <svg
      className="sverigekarta"
      viewBox={`0 0 ${hogerkant.toFixed(1)} ${(HOJD + MARGINAL * 2).toFixed(1)}`}
      role="img"
      aria-label={`Karta över Sverige. ${namn ? `${namn} finns i ` : "Orter: "}${orter}.`}
    >
      <path className="karta-land" d={landPath()} />
      {etiketter.map((p) => (
        <g key={`${p.namn}-${p.lat}`}>
          {/* Linjen binder ihop nålen med namnet när namnet knuffats ur led. */}
          <line
            className="karta-streck"
            x1={x(p.lng) + 3.4}
            y1={y(p.lat)}
            x2={x(p.lng) + 7}
            y2={p.yt}
          />
          <circle className="karta-nal" cx={x(p.lng)} cy={y(p.lat)} r="3.2" />
          <text className="karta-etikett" x={x(p.lng) + 8.5} y={p.yt + 2.4}>
            {p.namn}
          </text>
        </g>
      ))}
    </svg>
  );
}
