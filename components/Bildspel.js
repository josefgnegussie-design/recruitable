"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Hur länge varje bild står innan nästa visas.
const INTERVALL_MS = 3000;

// Bolagets egna bilder, på profilen och på korten. Högst fem, så det behövs
// inget bibliotek — en bild i taget med prickar under, och pilarna syns bara
// när det finns något att bläddra till.
//
// Med fler än en bild växlar bildspelet av sig självt, så att besökaren ser
// att det finns mer än den första bilden. Det stannar när det inte går att
// titta på det i lugn och ro: medan muspekaren eller tangentbordsfokus ligger
// på det, när det förstorats, när det inte syns på skärmen, och helt för den
// som bett sitt system om minskade animationer. Pilarna och prickarna gäller
// som förut, och ett klick räknar om tiden till nästa byte från början.
export default function Bildspel({ bilder = [], namn }) {
  const [index, setIndex] = useState(0);
  const [forstorad, setForstorad] = useState(false);
  const [pausad, setPausad] = useState(false);
  const [synlig, setSynlig] = useState(false);
  const [minskadRorelse, setMinskadRorelse] = useState(true);
  const rotRef = useRef(null);
  // Fokus ska tillbaka dit besökaren var när det förstorade läget stängs,
  // annars hamnar tangentbordet överst på sidan igen.
  const oppnarenRef = useRef(null);
  const stangRef = useRef(null);

  // Funktionsformen, inte setIndex(index + steg): två klick i snabb följd
  // batchas av React och skulle båda räkna från samma renderade index — då
  // hoppar bildspelet ett steg i stället för två.
  const stega = useCallback(
    (steg) => setIndex((i) => (i + steg + bilder.length) % bilder.length),
    [bilder.length]
  );

  // Bildspelet ligger numera också på urvalskortet i förfrågningsflödet, där
  // ett klick var som helst på kortet väljer eller väljer bort bolaget. Alla
  // kontroller här måste därför stoppa klicket — annars kryssar man ur bolaget
  // i samma rörelse som man bläddrar bland dess bilder. Skadar ingenting på
  // profilsidan, där ingenting lyssnar ovanför.
  const utan = (fn) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    fn();
  };

  const stang = useCallback(() => {
    setForstorad(false);
    oppnarenRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!forstorad) return;

    function vidTangent(e) {
      if (e.key === "Escape") stang();
      else if (e.key === "ArrowRight") stega(1);
      else if (e.key === "ArrowLeft") stega(-1);
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
  }, [forstorad, stang, stega]);

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

  const spelar = bilder.length > 1 && synlig && !pausad && !forstorad && !minskadRorelse;

  // Beror på index: varje byte — automatiskt eller för hand — startar en ny
  // nedräkning, så att en bild man just bläddrat fram inte byts ut direkt.
  useEffect(() => {
    if (!spelar) return;
    const timer = setTimeout(() => stega(1), INTERVALL_MS);
    return () => clearTimeout(timer);
  }, [spelar, index, stega]);

  if (!bilder.length) return null;

  const flera = bilder.length > 1;
  const bildtext = namn ? `Bild från ${namn}` : "";

  return (
    <>
      <div
        className="bildspel"
        ref={rotRef}
        onMouseEnter={() => setPausad(true)}
        onMouseLeave={() => setPausad(false)}
        onFocus={() => setPausad(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPausad(false);
        }}
      >
        <div className="bildspel-scen">
          {/* Knapp och inte bara en klickbar bild, så den går att nå med tabb
              och aktivera med mellanslag eller retur. */}
          <button
            type="button"
            ref={oppnarenRef}
            className="bildspel-oppna"
            onClick={utan(() => setForstorad(true))}
            aria-label={`Förstora bild ${index + 1} av ${bilder.length}`}
          >
            <img src={bilder[index]} alt={bildtext} />
            <span className="bildspel-forstora" aria-hidden="true">
              ⤢
            </span>
          </button>
          {flera && (
            <>
              <button
                type="button"
                className="bildspel-pil vanster"
                onClick={utan(() => stega(-1))}
                aria-label="Föregående bild"
              >
                ‹
              </button>
              <button
                type="button"
                className="bildspel-pil hoger"
                onClick={utan(() => stega(1))}
                aria-label="Nästa bild"
              >
                ›
              </button>
            </>
          )}
        </div>
        {flera && (
          <div className="bildspel-prickar">
            {bilder.map((url, i) => (
              <button
                key={url}
                type="button"
                className={`bildspel-prick${i === index ? " aktiv" : ""}`}
                onClick={utan(() => setIndex(i))}
                aria-label={`Visa bild ${i + 1} av ${bilder.length}`}
                aria-current={i === index}
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
            src={bilder[index]}
            alt={bildtext}
            onClick={(e) => e.stopPropagation()}
          />
          {flera && (
            <>
              <button
                type="button"
                className="bildspel-pil vanster stor"
                onClick={(e) => {
                  e.stopPropagation();
                  stega(-1);
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
                  stega(1);
                }}
                aria-label="Nästa bild"
              >
                ›
              </button>
              <div className="bildspel-raknare">
                {index + 1} / {bilder.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
