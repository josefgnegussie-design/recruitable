"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { beskarTillBlob, laddaBild, MALMATT } from "@/lib/bildbearbetning";

// Beskärningsruta: dra för att placera, reglage för att zooma.
//
// Zoomen räknas som hur stor del av bilden som syns, inte som en
// förstoringsfaktor. Zoom 1 betyder största möjliga utsnitt med rätt förhållande
// — hela bilden så långt formatet tillåter — och högre värden visar mindre av
// den. Det gör att utsnittet aldrig kan hamna utanför bilden, och att ramen
// alltid är helt fylld. Alternativet, att låta användaren dra ut bilden och
// själv upptäcka de vita kanterna, är sämre för alla.
export default function BildBeskarare({ fil, typ = "bildspel", onKlar, onAvbryt }) {
  const mal = MALMATT[typ] || MALMATT.bildspel;

  const [bild, setBild] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [mitt, setMitt] = useState({ x: 0.5, y: 0.5 });
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState("");

  const ramRef = useRef(null);
  const dragRef = useRef(null);

  // Härledd och inte satt i en effekt: räknades den i renderingen skapades en ny
  // objekt-URL för varje musrörelse under ett drag.
  const forhandsUrl = useMemo(() => (fil instanceof Blob ? URL.createObjectURL(fil) : fil), [fil]);

  useEffect(
    () => () => {
      if (fil instanceof Blob) URL.revokeObjectURL(forhandsUrl);
    },
    [fil, forhandsUrl]
  );

  useEffect(() => {
    let levande = true;

    laddaBild(fil)
      .then((b) => {
        if (!levande) return;
        setBild(b);
        setZoom(1);
        setMitt({ x: 0.5, y: 0.5 });
      })
      .catch(() => levande && setFel("Kunde inte läsa bilden. Prova en annan fil."));
    return () => {
      levande = false;
    };
  }, [fil]);

  const bredd = bild?.width || 0;
  const hojd = bild?.height || 0;

  // Utsnittet i bildens egna pixlar, utifrån zoom och mittpunkt.
  function utsnitt() {
    const maxBredd = Math.min(bredd, hojd * mal.forhallande);
    const utBredd = maxBredd / zoom;
    const utHojd = utBredd / mal.forhallande;

    // Mittpunkten begränsas så att utsnittet aldrig går utanför bilden.
    const halvB = utBredd / 2;
    const halvH = utHojd / 2;
    const cx = Math.min(Math.max(mitt.x * bredd, halvB), bredd - halvB);
    const cy = Math.min(Math.max(mitt.y * hojd, halvH), hojd - halvH);

    return { x: cx - halvB, y: cy - halvH, bredd: utBredd, hojd: utHojd };
  }

  function vidDragStart(e) {
    const punkt = e.touches?.[0] || e;
    dragRef.current = { x: punkt.clientX, y: punkt.clientY, mitt: { ...mitt } };
  }

  function vidDrag(e) {
    if (!dragRef.current || !bild) return;
    const punkt = e.touches?.[0] || e;
    const ram = ramRef.current?.getBoundingClientRect();
    if (!ram) return;

    const u = utsnitt();
    // Hur många av bildens pixlar en skärmpixel motsvarar just nu.
    const skala = u.bredd / ram.width;
    const dx = ((punkt.clientX - dragRef.current.x) * skala) / bredd;
    const dy = ((punkt.clientY - dragRef.current.y) * skala) / hojd;

    setMitt({
      x: dragRef.current.mitt.x - dx,
      y: dragRef.current.mitt.y - dy,
    });
  }

  function vidDragSlut() {
    dragRef.current = null;
  }

  async function anvand() {
    if (!bild) return;
    setArbetar(true);
    setFel("");
    try {
      const blob = await beskarTillBlob(bild, utsnitt(), mal);
      await onKlar(blob);
    } catch (err) {
      setFel(err.message || "Kunde inte bearbeta bilden.");
      setArbetar(false);
    }
  }

  const u = bild ? utsnitt() : null;
  // Bilden placeras med background-position/size så att utsnittet fyller ramen.
  const stil = u
    ? {
        backgroundImage: `url(${forhandsUrl})`,
        backgroundSize: `${(bredd / u.bredd) * 100}% ${(hojd / u.hojd) * 100}%`,
        backgroundPosition: `${(u.x / (bredd - u.bredd || 1)) * 100}% ${(u.y / (hojd - u.hojd || 1)) * 100}%`,
      }
    : {};

  return (
    <div className="confirm-overlay" onClick={() => !arbetar && onAvbryt()}>
      <div className="confirm-modal beskarare" onClick={(e) => e.stopPropagation()}>
        <h3>Placera bilden</h3>
        <p className="sub">
          Dra för att flytta och använd reglaget för att zooma. Det som syns i rutan är det som
          sparas — {typ === "logo" ? "kvadratiskt" : "i formatet 3:2"}.
        </p>

        {fel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{fel}</p>}

        <div
          className={`beskarare-ram${typ === "logo" ? " kvadrat" : ""}`}
          ref={ramRef}
          style={stil}
          onMouseDown={vidDragStart}
          onMouseMove={vidDrag}
          onMouseUp={vidDragSlut}
          onMouseLeave={vidDragSlut}
          onTouchStart={vidDragStart}
          onTouchMove={vidDrag}
          onTouchEnd={vidDragSlut}
        >
          {!bild && <span className="note">Läser bilden…</span>}
        </div>

        <label className="beskarare-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="4"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={!bild}
          />
        </label>

        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onAvbryt} disabled={arbetar}>
            Avbryt
          </button>
          <button type="button" className="qs-btn" onClick={anvand} disabled={!bild || arbetar}>
            {arbetar ? "Sparar…" : "Använd bilden"}
          </button>
        </div>
      </div>
    </div>
  );
}
