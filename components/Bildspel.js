"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Hur länge varje uppslag står innan nästa visas.
const INTERVALL_MS = 3000;

// Under den här bredden ryms bara en bild. Samma brytpunkt som resten av
// profilen använder för sitt enspaltsläge.
const MOBIL = "(max-width: 640px)";

// Bolagets egna bilder, på profilen och på korten. Högst fem, så det behövs
// inget bibliotek.
//
// På dator och surfplatta visas TVÅ bilder samtidigt: panelen är bred, och en
// ensam bild i 3:2 lämnade antingen ett tomrum bredvid sig eller blev orimligt
// hög. Båda byts i samma steg — att låta den ena stå kvar medan den andra bytte
// drog ögat till fel bild. På mobil är ytan för smal för två, och då visas en i
// taget som förut.
//
// Med fler bilder än som ryms växlar bildspelet av sig självt, så att besökaren
// ser att det finns mer. Det stannar när det inte går att titta på det i lugn
// och ro: medan muspekaren eller tangentbordsfokus ligger på det, när en bild
// förstorats, när det inte syns på skärmen, och helt för den som bett sitt
// system om minskade animationer.
export default function Bildspel({ bilder = [], namn }) {
  // Index för den FÖRSTA bilden i uppslaget, inte för en enskild bild.
  const [start, setStart] = useState(0);
  // Vilken bild som är förstorad, eller null. Egen räknare: förstoringen visar
  // alltid en bild i taget, oavsett hur många som ligger i uppslaget bakom.
  const [forstoradIndex, setForstoradIndex] = useState(null);
  const [antalSynliga, setAntalSynliga] = useState(1);
  const [pausad, setPausad] = useState(false);
  const [synlig, setSynlig] = useState(false);
  const [minskadRorelse, setMinskadRorelse] = useState(true);
  const rotRef = useRef(null);
  // Fokus ska tillbaka dit besökaren var när det förstorade läget stängs,
  // annars hamnar tangentbordet överst på sidan igen.
  const oppnarenRef = useRef(null);
  const stangRef = useRef(null);

  const forstorad = forstoradIndex !== null;
  const antal = Math.min(antalSynliga, bilder.length);
  // Sista uppslaget börjar här. Att klampa i stället för att räkna hela sidor
  // gör att det aldrig uppstår en tom ruta bredvid den sista bilden — uppslagen
  // överlappar i stället med en bild, vilket ser bättre ut än ett hål.
  const maxStart = Math.max(0, bilder.length - antal);

  // Uppslagen, som startindex. Sista är klampat till maxStart, så att det
  // aldrig uppstår en tom ruta bredvid den sista bilden — uppslagen överlappar
  // i stället med en bild, vilket ser bättre ut än ett hål. Med tre bilder i två
  // rutor blir listan [0, 1]: andra uppslaget visar bild två och tre.
  //
  // Pilarna, prickarna och den automatiska växlingen går alla genom den HÄR
  // listan. Räknade pilarna i stället i hela steg skulle de kunna landa mellan
  // två prickar — bakåt från ett klampat sista uppslag är just ett sådant fall.
  const uppslag = useMemo(() => {
    if (!bilder.length) return [0];
    const max = Math.max(0, bilder.length - antal);
    return [
      ...new Set(
        Array.from({ length: Math.ceil(bilder.length / antal) }, (_, i) => Math.min(i * antal, max))
      ),
    ];
  }, [bilder.length, antal]);

  // Funktionsformen, inte setStart(start + steg): två klick i snabb följd
  // batchas av React och skulle båda räkna från samma renderade värde — då
  // hoppar bildspelet ett steg i stället för två.
  const stega = useCallback(
    (riktning) =>
      setStart((s) => {
        const nu = uppslag.indexOf(s);
        // Hamnar start utanför listan — en omritning vid ändrad bredd — är
        // närmaste uppslag bakåt det rimliga att räkna ifrån.
        const fran = nu === -1 ? Math.max(0, uppslag.findLastIndex((u) => u <= s)) : nu;
        return uppslag[(fran + riktning + uppslag.length) % uppslag.length];
      }),
    [uppslag]
  );

  const stegaForstorad = useCallback(
    (riktning) =>
      setForstoradIndex((i) => (i === null ? i : (i + riktning + bilder.length) % bilder.length)),
    [bilder.length]
  );

  // Bildspelet ligger också på urvalskortet i förfrågningsflödet, där ett klick
  // var som helst på kortet väljer eller väljer bort bolaget. Alla kontroller
  // här måste därför stoppa klicket — annars kryssar man ur bolaget i samma
  // rörelse som man bläddrar bland dess bilder.
  const utan = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  const stang = useCallback(() => {
    setForstoradIndex(null);
    oppnarenRef.current?.focus();
  }, []);

  // Hur många bilder som ryms. Lyssnar på ändringar, så att den som vrider på
  // plattan eller drar i fönstret får rätt antal utan omladdning.
  useEffect(() => {
    const fraga = window.matchMedia(MOBIL);
    const uppdatera = () => setAntalSynliga(fraga.matches ? 1 : 2);
    uppdatera();
    fraga.addEventListener("change", uppdatera);
    return () => fraga.removeEventListener("change", uppdatera);
  }, []);

  // Ändras antalet kan det gamla startvärdet ligga utanför: sista uppslaget
  // flyttar sig när två bilder blir en.
  useEffect(() => {
    setStart((s) => Math.min(s, Math.max(0, bilder.length - Math.min(antalSynliga, bilder.length))));
  }, [antalSynliga, bilder.length]);

  useEffect(() => {
    if (!forstorad) return;

    function vidTangent(e) {
      if (e.key === "Escape") stang();
      else if (e.key === "ArrowRight") stegaForstorad(1);
      else if (e.key === "ArrowLeft") stegaForstorad(-1);
    }

    // Sidan bakom ska inte gå att skrolla medan bilden ligger över den.
    const tidigareOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", vidTangent);
    stangRef.current?.focus();

    return () => {
      document.body.style.overflow = tidigareOverflow;
      document.removeEventListener("keydown", vidTangent);
    };
  }, [forstorad, stang, stegaForstorad]);

  useEffect(() => {
    const fraga = window.matchMedia("(prefers-reduced-motion: reduce)");
    const uppdatera = () => setMinskadRorelse(fraga.matches);
    uppdatera();
    fraga.addEventListener("change", uppdatera);
    return () => fraga.removeEventListener("change", uppdatera);
  }, []);

  // Urvalslistan kan ha hundra kort. Bara de som syns ska byta bild, annars
  // hämtas bilder ingen tittar på.
  useEffect(() => {
    const rot = rotRef.current;
    if (!rot || typeof IntersectionObserver === "undefined") return;
    const observator = new IntersectionObserver(([post]) => setSynlig(post.isIntersecting), {
      threshold: 0.5,
    });
    observator.observe(rot);
    return () => observator.disconnect();
  }, []);

  // Går det inte att bläddra finns inget att spela upp — två bilder i två rutor
  // är ett enda uppslag, till skillnad från fyra.
  const kanBladdra = bilder.length > antal;
  const spelar = kanBladdra && synlig && !pausad && !forstorad && !minskadRorelse;

  // Beror på start: varje byte — automatiskt eller för hand — startar en ny
  // nedräkning, så att ett uppslag man just bläddrat fram inte byts ut direkt.
  useEffect(() => {
    if (!spelar) return;
    const timer = setTimeout(() => stega(1), INTERVALL_MS);
    return () => clearTimeout(timer);
  }, [spelar, start, stega]);

  if (!bilder.length) return null;

  const bildtext = namn ? `Bild från ${namn}` : "";
  const synligaBilder = bilder.slice(start, start + antal);

  return (
    <>
      <div
        className={`bildspel${antal > 1 ? " uppslag" : ""}`}
        ref={rotRef}
        onMouseEnter={() => setPausad(true)}
        onMouseLeave={() => setPausad(false)}
        onFocus={() => setPausad(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPausad(false);
        }}
      >
        <div className={`bildspel-scen${antal > 1 ? " tva" : ""}`}>
          {synligaBilder.map((url, i) => {
            const bildIndex = start + i;
            return (
              /* Knapp och inte bara en klickbar bild, så den går att nå med
                 tabb och aktivera med mellanslag eller retur. Varje bild i
                 uppslaget öppnar sig själv — inte uppslagets första. */
              <button
                key={url}
                type="button"
                ref={i === 0 ? oppnarenRef : undefined}
                className="bildspel-oppna"
                onClick={utan(() => setForstoradIndex(bildIndex))}
                aria-label={`Förstora bild ${bildIndex + 1} av ${bilder.length}`}
              >
                <img src={url} alt={bildtext} />
                <span className="bildspel-forstora" aria-hidden="true">
                  ⤢
                </span>
              </button>
            );
          })}
          {kanBladdra && (
            <>
              <button
                type="button"
                className="bildspel-pil vanster"
                onClick={utan(() => stega(-1))}
                aria-label={antal > 1 ? "Föregående bilder" : "Föregående bild"}
              >
                ‹
              </button>
              <button
                type="button"
                className="bildspel-pil hoger"
                onClick={utan(() => stega(1))}
                aria-label={antal > 1 ? "Nästa bilder" : "Nästa bild"}
              >
                ›
              </button>
            </>
          )}
        </div>
        {kanBladdra && (
          <div className="bildspel-prickar">
            {uppslag.map((s) => (
              <button
                key={s}
                type="button"
                className={`bildspel-prick${s === start ? " aktiv" : ""}`}
                onClick={utan(() => setStart(s))}
                aria-label={
                  antal > 1
                    ? `Visa bild ${s + 1} och ${Math.min(s + antal, bilder.length)} av ${bilder.length}`
                    : `Visa bild ${s + 1} av ${bilder.length}`
                }
                aria-current={s === start}
              />
            ))}
          </div>
        )}
      </div>

      {forstorad && (
        // Klick på bakgrunden stänger, klick på själva bilden gör det inte —
        // annars stänger man av misstag när man siktar på nästa-pilen.
        <div
          className="bildspel-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={bildtext || "Förstorad bild"}
          onClick={stang}
        >
          <button
            type="button"
            ref={stangRef}
            className="bildspel-stang"
            onClick={stang}
            aria-label="Stäng"
          >
            ✕
          </button>
          <img
            className="bildspel-stor"
            src={bilder[forstoradIndex]}
            alt={bildtext}
            onClick={(e) => e.stopPropagation()}
          />
          {bilder.length > 1 && (
            <>
              <button
                type="button"
                className="bildspel-pil vanster stor"
                onClick={(e) => {
                  e.stopPropagation();
                  stegaForstorad(-1);
                }}
                aria-label="Föregående bild"
              >
                ‹
              </button>
              <button
                type="button"
                className="bildspel-pil hoger stor"
                onClick={(e) => {
                  e.stopPropagation();
                  stegaForstorad(1);
                }}
                aria-label="Nästa bild"
              >
                ›
              </button>
              <div className="bildspel-raknare">
                {forstoradIndex + 1} / {bilder.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
