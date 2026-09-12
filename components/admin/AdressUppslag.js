"use client";

import { useEffect, useId, useRef, useState } from "react";

const DEBOUNCE_MS = 250;

// Fält med förslagslista ur postnummerregistret. Samma mönster och styling som
// ForetagsSok i registreringen — skriv, välj ur listan, eller strunta i listan
// och skriv klart för hand. Uppslaget är en genväg, aldrig ett krav.
//
// Två lägen:
//   typ="postnummer" — siffror ger postnummer, och valet fyller i postorten med.
//                      Ett fullständigt och giltigt postnummer fyller i postorten
//                      direkt, utan att något behöver väljas.
//   typ="postort"    — bokstäver ger orter. Postnumret går inte att härleda
//                      åt andra hållet, så bara orten fylls i.
export default function AdressUppslag({ id, typ, value, onChange, onValj, placeholder }) {
  const [traffar, setTraffar] = useState([]);
  const [open, setOpen] = useState(false);
  const [laddar, setLaddar] = useState(false);
  const [aktiv, setAktiv] = useState(-1);
  const [sokt, setSokt] = useState(false);

  const listId = useId();
  const wrapRef = useRef(null);
  // Bara det användaren själv skrivit ska utlösa en sökning. Ett valt förslag
  // eller ett värde som kommer utifrån ska inte öppna listan på nytt.
  const skrivet = useRef(null);
  // Senaste postnummer vi autofyllde postorten för, så att samma svar inte
  // skriver över en postort användaren rättat för hand.
  const autofyllt = useRef(null);

  const minLangd = typ === "postnummer" ? 3 : 2;

  useEffect(() => {
    if (value !== skrivet.current) return;

    const fraga = value.trim();
    if (fraga.replace(/\s/g, "").length < minLangd) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLaddar(true);
      try {
        const res = await fetch(`/api/postnummer/sok?q=${encodeURIComponent(fraga)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        const lista = res.ok ? body.traffar || [] : [];

        // Fullständigt postnummer: fyll i postorten utan att besvära med en lista.
        if (typ === "postnummer" && body.exakt && autofyllt.current !== body.exakt.postnummer) {
          autofyllt.current = body.exakt.postnummer;
          onValj(body.exakt);
          setOpen(false);
          setTraffar([]);
        } else {
          setTraffar(lista);
          setSokt(true);
          setOpen(true);
          setAktiv(-1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setTraffar([]);
          setSokt(true);
        }
      } finally {
        if (!controller.signal.aborted) setLaddar(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, typ, minLangd, onValj]);

  useEffect(() => {
    if (!open) return;
    function vidKlick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", vidKlick);
    return () => document.removeEventListener("mousedown", vidKlick);
  }, [open]);

  function handleChange(nasta) {
    skrivet.current = nasta;
    autofyllt.current = null;
    onChange(nasta);
    if (nasta.trim().replace(/\s/g, "").length < minLangd) {
      setTraffar([]);
      setSokt(false);
      setOpen(false);
    }
  }

  function valj(traff) {
    skrivet.current = null;
    setOpen(false);
    setTraffar([]);
    setAktiv(-1);
    onValj(traff);
  }

  function vidTangent(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || traffar.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => (i + 1) % traffar.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => (i <= 0 ? traffar.length - 1 : i - 1));
    } else if (e.key === "Enter" && aktiv >= 0) {
      // Bara när ett förslag är markerat — annars ska Enter skicka formuläret.
      e.preventDefault();
      valj(traffar[aktiv]);
    }
  }

  return (
    <div className="lookup-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        inputMode={typ === "postnummer" ? "numeric" : "text"}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => traffar.length > 0 && setOpen(true)}
        // Klick utanför fångas av mousedown-lyssnaren ovan, men den som tabbar
        // vidare till nästa fält rör aldrig musen — utan det här blir listan
        // stående öppen ovanpå fältet man just flyttat till. Flyttas fokus in i
        // listan själv ska den förstås vara kvar.
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
        }}
        onKeyDown={vidTangent}
        placeholder={placeholder}
        autoComplete={typ === "postnummer" ? "postal-code" : "address-level2"}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {laddar && <span className="lookup-spinner">Söker…</span>}

      {open && (
        <ul className="lookup-list" id={listId} role="listbox">
          {traffar.length === 0 && sokt ? (
            <li className="lookup-empty">Inga träffar — skriv in adressen för hand.</li>
          ) : (
            traffar.map((traff, i) => (
              <li key={traff.postnummer || traff.postort} role="option" aria-selected={i === aktiv}>
                <button
                  type="button"
                  className={`lookup-item ${i === aktiv ? "active" : ""}`}
                  onMouseEnter={() => setAktiv(i)}
                  onClick={() => valj(traff)}
                >
                  <span className="lookup-name">{traff.postnummer || traff.postort}</span>
                  {traff.postnummer && <span className="lookup-meta">{traff.postort}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
