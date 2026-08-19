"use client";

import { useEffect, useId, useRef, useState } from "react";

// Flervalsfält där listan står kvar öppen tills användaren själv stänger den.
// En vanlig <select multiple> eller en rullgardinsmeny som slår igen efter varje
// val tvingar den som ska kryssa i fem yrkesområden att öppna menyn fem gånger —
// här bockar man för allt på en gång och stänger när man är klar.
export default function MultiSelectField({
  id,
  options,
  selected,
  onChange,
  placeholder = "Välj...",
  allLabel = "Välj alla",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggle(option) {
    onChange(
      selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]
    );
  }

  const allSelected = selected.length === options.length;
  const summary =
    selected.length === 0 ? placeholder : `${selected.length} av ${options.length} valda`;

  return (
    <div className="multiselect" ref={wrapRef}>
      <button
        id={id}
        type="button"
        className={`multiselect-trigger ${selected.length === 0 ? "empty" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        {summary}
      </button>

      {open && (
        <div className="multiselect-panel" id={panelId}>
          <div className="multiselect-actions">
            <button
              type="button"
              className="link-btn"
              onClick={() => onChange(allSelected ? [] : [...options])}
            >
              {allSelected ? "Avmarkera alla" : allLabel}
            </button>
            <button type="button" className="link-btn" onClick={() => setOpen(false)}>
              Klar
            </button>
          </div>
          <div className="multiselect-options" role="group">
            {options.map((option) => (
              <label className="multiselect-option" key={option}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
