"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TJANSTBESKRIVNINGAR, TJANSTER } from "@/lib/taxonomy";

// Frågetecknet bredvid tjänstefiltret.
//
// Öppnas vid hovring, men inte BARA vid hovring: en mobil har ingen hovring och
// ett tangentbord har ingen mus. Knappen svarar därför på hovring, fokus och
// klick var för sig, och Escape eller ett klick utanför stänger den. En ruta som
// bara går att få fram med muspekare är en ruta halva besökarna aldrig ser.

// Texten kommer från taxonomin och inte från användare, så delarna är kända.
function medFetstil(text) {
  return text.split("**").map((del, i) => (i % 2 ? <b key={i}>{del}</b> : del));
}

// Vad rutan säger beror på vem som läser den. Kunden ska förstå vilken tjänst
// de ska filtrera på; bolaget ska förstå vad de lovar genom att kryssa i en.
const TILLTAL = {
  kund: {
    ingress: "Tjänsterna avgör vilka bolag ni når. Så här skiljer de sig åt:",
    etikett: "Passar när",
    knapp: "Vad betyder de olika tjänsterna?",
  },
  bolag: {
    ingress: "Välj om ni kan erbjuda tjänsten. Kunderna ser samma beskrivningar när de söker.",
    etikett: "Välj om ni",
    knapp: "Vad innebär de olika tjänsterna?",
  },
};

export default function TjanstInfo({ malgrupp = "kund" }) {
  const tilltal = TILLTAL[malgrupp] || TILLTAL.kund;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const rutaRef = useRef(null);

  // Rutan är hög — fem tjänster med två meningar var — och frågetecknet sitter
  // mitt på sidan. Hänger den rakt nedåt hamnar nederdelen under vikkanten, och
  // att skrolla dit tar musen ur rutan så att den stängs. Den läggs därför åt
  // det håll det finns mest plats, med en maxhöjd av just den platsen: syns den
  // alls ska den synas hel.
  //
  // Skrivs rakt på elementet och inte genom state: det här är en mätning mot
  // fönstret, inte något React känner till, och ett tillstånd till hade bara
  // gett en extra rendering för samma resultat.
  useLayoutEffect(() => {
    if (!open) return;

    function placera() {
      const ruta = rutaRef.current;
      if (!ruta) return;

      // På smal skärm ligger rutan fast förankrad i nederkanten, se globals.css.
      if (window.innerWidth <= 640) {
        ruta.style.maxHeight = "";
        ruta.classList.remove("uppat");
        return;
      }

      const knapp = wrapRef.current.getBoundingClientRect();
      const under = window.innerHeight - knapp.bottom - 16;
      const over = knapp.top - 16;
      const uppat = over > under;

      ruta.classList.toggle("uppat", uppat);
      ruta.style.maxHeight = `${Math.max(160, Math.round(uppat ? over : under))}px`;
    }

    placera();

    // Räknas om medan rutan står öppen: en telefon som vänds, eller ett fönster
    // som dras ihop, ändrar både vilket håll som har plats och hur mycket.
    window.addEventListener("resize", placera);
    return () => window.removeEventListener("resize", placera);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function vidKlickUtanfor(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function vidTangent(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", vidKlickUtanfor);
    document.addEventListener("keydown", vidTangent);
    return () => {
      document.removeEventListener("mousedown", vidKlickUtanfor);
      document.removeEventListener("keydown", vidTangent);
    };
  }, [open]);

  return (
    <span
      className="tjanst-info"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tjanst-info-knapp"
        aria-expanded={open}
        aria-label={tilltal.knapp}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
      >
        ?
      </button>

      {open && (
        <div className="tjanst-info-ruta" ref={rutaRef} role="note">
          <p className="tjanst-info-ingress">{tilltal.ingress}</p>
          <dl>
            {TJANSTER.map((tjanst) => {
              const t = TJANSTBESKRIVNINGAR[tjanst]?.[malgrupp];
              if (!t) return null;
              return (
                <div key={tjanst}>
                  <dt>{tjanst}</dt>
                  <dd>
                    <span className="tjanst-info-betyder">{medFetstil(t.betyder)}</span>
                    <span className="tjanst-info-nar">
                      <span className="tjanst-info-etikett">{tilltal.etikett}</span>
                      {medFetstil(t.nar)}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </span>
  );
}
