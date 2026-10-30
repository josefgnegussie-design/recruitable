import { BREDD, HOJD, MARGINAL, landPath, x, y } from "@/components/Sverigekarta";

// Hela registret på en karta, överst på startsidan. Samma prickade silhuett
// som profilsidans karta, men i stället för ett bolags kontor visas var alla
// bolag finns: en orange prick per ruta med minst ett bolag, större ju fler.
//
// Bilden är gjord av sajtens egen data. Det är den som gör att startsidan
// inte ser ut som vilken tjänstesida som helst — en illustration hade kunnat
// höra till vem som helst, de här prickarna hör bara till Recruitable.
//
// Rutorna är desamma som silhuettens (0,15 breddgrader × 0,3 längdgrader), så
// varje bolagsprick hamnar ovanpå en landprick i stället för bredvid den.
const LAT_STEG = 0.15;
const LNG_STEG = 0.3;

// Logaritmisk storlek: Stockholm har hundratals bolag, de flesta orter ett
// eller två. Linjärt hade Stockholm täckt halva Svealand och resten blivit
// osynligt.
function radie(antal) {
  return Math.min(9, 1.7 + 1.25 * Math.log2(antal));
}

export default function Registerkarta({ punkter = [], antalBolag }) {
  const rutor = new Map();
  for (const [lat, lng] of punkter) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const rad = Math.round(lat / LAT_STEG);
    const kol = Math.round(lng / LNG_STEG);
    const nyckel = `${rad}:${kol}`;
    const r = rutor.get(nyckel);
    if (r) r.antal++;
    else rutor.set(nyckel, { lat: rad * LAT_STEG, lng: kol * LNG_STEG, antal: 1 });
  }

  // Störst först, så att små orter ritas ovanpå och inte göms under en storstad.
  const prickar = [...rutor.values()].sort((a, b) => b.antal - a.antal);
  const antalOrter = prickar.length;

  return (
    <figure className="registerkarta">
      <svg
        viewBox={`0 0 ${(BREDD + MARGINAL * 2).toFixed(1)} ${(HOJD + MARGINAL * 2).toFixed(1)}`}
        role="img"
        aria-label={`Karta över Sverige med registrets bolag utsatta på ${antalOrter} platser.`}
      >
        <path className="karta-land" d={landPath()} />
        {prickar.map((p) => (
          <circle
            key={`${p.lat}:${p.lng}`}
            className="karta-bolag"
            cx={x(p.lng).toFixed(1)}
            cy={y(p.lat).toFixed(1)}
            r={radie(p.antal).toFixed(2)}
          />
        ))}
      </svg>
      {antalBolag ? (
        <figcaption>
          <span className="registerkarta-tal">{antalBolag.toLocaleString("sv-SE")}</span>
          <span>bolag i registret, utspridda på {antalOrter.toLocaleString("sv-SE")} platser i landet.</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
