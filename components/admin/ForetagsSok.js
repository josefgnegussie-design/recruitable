"use client";

import { useEffect, useId, useRef, useState } from "react";

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 350;

// Sökfält för företagsnamn med förslagslista från /api/foretag/sok. Väljer besökaren
// ett förslag skickas hela träffen vidare till onSelect, som fyller i org.nummer och
// adress. Hittar sökningen inget — eller ligger källan nere — går fältet att skriva i
// precis som vanligt; autofyllet är en genväg, aldrig ett krav.
export default function ForetagsSok({ id, value, onChange, onSelect, disabled }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);

  const listId = useId();
  const wrapRef = useRef(null);
  // Håller det användaren senast skrivit själv. Bara det ska utlösa en sökning —
  // ett återställt utkast eller ett valt förslag ska inte öppna listan på nytt.
  const typedValue = useRef(null);

  useEffect(() => {
    if (value !== typedValue.current) return;

    // För korta sökningar rensas listan i handleChange nedan — effekten sköter
    // bara själva anropet, som alltid ligger bakom en fördröjning.
    const query = value.trim();
    if (query.length < MIN_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/foretag/sok?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        setResults(res.ok ? body.traffar || [] : []);
        setSearched(true);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        // Avbruten eller misslyckad sökning: inga förslag, men fältet fungerar.
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Klick utanför stänger listan.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleChange(next) {
    typedValue.current = next;
    onChange(next);
    if (next.trim().length < MIN_LENGTH) {
      setResults([]);
      setSearched(false);
      setOpen(false);
    }
  }

  function choose(candidate) {
    typedValue.current = null;
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
    onSelect(candidate);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Bara när ett förslag är markerat — annars ska Enter skicka formuläret.
      e.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <div className="lookup-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        required
        autoComplete="organization"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {loading && <span className="lookup-spinner">Söker…</span>}

      {open && (
        <ul className="lookup-list" id={listId} role="listbox">
          {results.length === 0 && searched ? (
            <li className="lookup-empty">Inga träffar — fyll i uppgifterna för hand.</li>
          ) : (
            results.map((candidate, i) => (
              <li key={candidate.orgnr} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`lookup-item ${i === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(candidate)}
                >
                  <span className="lookup-name">{candidate.namn}</span>
                  <span className="lookup-meta">
                    {[candidate.orgnr, candidate.adress].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
