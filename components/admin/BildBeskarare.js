"use client";

import { useEffect, useRef, useState } from "react";
import { beskarTillBlob, laddaBild, MALMATT } from "@/lib/bildbearbetning";

// Beskärningsruta: dra för att placera, reglage för att zooma.
//
// Förhandsvisningen ritas på en canvas med exakt samma anrop som exporten, så
// det man ser är det som sparas. Första versionen visade bilden som en
// CSS-bakgrund via en objekt-URL, och den URL:en hann återkallas av
// städfunktionen innan bilden ritats ut — rutan blev tom. En canvas har ingen
// sådan livslängd att hålla reda på.
//
// Zoomen räknas som hur stor del av bilden som syns. Reglagets nedre ände är
// den punkt där HELA bilden får plats i ramen — är bilden bredare än formatet
// blir det tomma kanter ovanför och under, och det är avsiktligt. En logotyp
// måste kunna visas hel, och tvingande beskärning var just det som gjorde att
// bolaget inte fick in sin bild som det ville.
export default function BildBeskarare({ fil, typ = "bildspel", onKlar, onAvbryt }) {
  const mal = MALMATT[typ] || MALMATT.bildspel;

  const [bild, setBild] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [mitt, setMitt] = useState({ x: 0.5, y: 0.5 });
  const [arbetar, setArbetar] = useState(false);
  const [fel, setFel] = useState("");

  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const bredd = bild?.width || 0;
  const hojd = bild?.height || 0;

  // Största utsnitt som får plats i bilden med rätt förhållande. Zoom 1.
  const maxBredd = bredd ? Math.min(bredd, hojd * mal.forhallande) : 0;

  // Vid vilken zoom hela bilden ryms i ramen. Under 1 när bilden inte har samma
  // förhållande som ramen — då krävs tomma kanter för att visa allt.
  const minZoom = bredd ? Math.min(1, maxBredd / bredd, maxBredd / (mal.forhallande * hojd)) : 1;

  useEffect(() => {
    let levande = true;
    laddaBild(fil)
      .then((b) => {
        if (!levande) return;
        setBild(b);
        setMitt({ x: 0.5, y: 0.5 });
        // Utgångsläget är hela bilden synlig, inte största beskurna utsnitt. Den
        // som vill beskära zoomar in; den som bara vill få in sin logotyp hel
        // behöver inte göra någonting. Räknas här och inte i en effekt, som
        // hade gett en extra rendering direkt efter den första.
        const max = Math.min(b.width, b.height * mal.forhallande);
        setZoom(Math.min(1, max / b.width, max / (mal.forhallande * b.height)));
      })
      .catch(() => levande && setFel("Kunde inte läsa bilden. Prova en annan fil."));
    return () => {
      levande = false;
    };
  }, [fil, mal.forhallande]);

  // Utsnittet i bildens egna pixlar. Är utsnittet större än bilden i någon
  // riktning centreras det där i stället för att klämmas in — annars gick det
  // inte att zooma ut förbi bildens kant.
  function utsnitt() {
    const utBredd = maxBredd / zoom;
    const utHojd = utBredd / mal.forhallande;
    const halvB = utBredd / 2;
    const halvH = utHojd / 2;

    const cx =
      utBredd >= bredd ? bredd / 2 : Math.min(Math.max(mitt.x * bredd, halvB), bredd - halvB);
    const cy = utHojd >= hojd ? hojd / 2 : Math.min(Math.max(mitt.y * hojd, halvH), hojd - halvH);

    return { x: cx - halvB, y: cy - halvH, bredd: utBredd, hojd: utHojd };
  }

  // Ritar om förhandsvisningen när bild, zoom eller placering ändras.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bild) return;

    const utBredd = maxBredd / zoom;
    const utHojd = utBredd / mal.forhallande;
    const halvB = utBredd / 2;
    const halvH = utHojd / 2;
    const cx =
      utBredd >= bredd ? bredd / 2 : Math.min(Math.max(mitt.x * bredd, halvB), bredd - halvB);
    const cy = utHojd >= hojd ? hojd / 2 : Math.min(Math.max(mitt.y * hojd, halvH), hojd - halvH);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      bild,
      cx - halvB,
      cy - halvH,
      utBredd,
      utHojd,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [bild, zoom, mitt, maxBredd, bredd, hojd, mal.forhallande]);

  function vidDragStart(e) {
    const punkt = e.touches?.[0] || e;
    dragRef.current = { x: punkt.clientX, y: punkt.clientY, mitt: { ...mitt } };
  }

  function vidDrag(e) {
    if (!dragRef.current || !bild) return;
    const punkt = e.touches?.[0] || e;
    const ram = canvasRef.current?.getBoundingClientRect();
    if (!ram) return;

    // Hur många av bildens pixlar en skärmpixel motsvarar just nu.
    const skala = maxBredd / zoom / ram.width;
    const dx = ((punkt.clientX - dragRef.current.x) * skala) / bredd;
    const dy = ((punkt.clientY - dragRef.current.y) * skala) / hojd;

    setMitt({ x: dragRef.current.mitt.x - dx, y: dragRef.current.mitt.y - dy });
  }

  function vidDragSlut() {
    dragRef.current = null;
  }

  async function anvand() {
    if (!bild) return;
    setArbetar(true);
    setFel("");
    try {
      await onKlar(await beskarTillBlob(bild, utsnitt(), mal));
    } catch (err) {
      setFel(err.message || "Kunde inte bearbeta bilden.");
      setArbetar(false);
    }
  }

  // Finns det något att dra? Rymmer utsnittet hela bilden ska markören inte
  // lova en förflyttning som inte går att göra.
  const gardragbar = bild ? maxBredd / zoom < bredd || maxBredd / zoom / mal.forhallande < hojd : false;

  return (
    <div className="confirm-overlay" onClick={() => !arbetar && onAvbryt()}>
      <div className="confirm-modal beskarare" onClick={(e) => e.stopPropagation()}>
        <h3>Placera bilden</h3>
        <p className="sub">
          Dra för att flytta och använd reglaget för att zooma. Det som syns i rutan är det som
          sparas — {typ === "logo" ? "kvadratiskt" : "i formatet 3:2"}. Zoomar du ut förbi bildens
          kant blir kanterna tomma.
        </p>

        {fel && <p style={{ color: "var(--color-error)", fontSize: 13 }}>{fel}</p>}

        <div className={`beskarare-ram${typ === "logo" ? " kvadrat" : ""}`}>
          <canvas
            ref={canvasRef}
            width={mal.bredd}
            height={mal.hojd}
            className={gardragbar ? "dragbar" : ""}
            onMouseDown={vidDragStart}
            onMouseMove={vidDrag}
            onMouseUp={vidDragSlut}
            onMouseLeave={vidDragSlut}
            onTouchStart={vidDragStart}
            onTouchMove={vidDrag}
            onTouchEnd={vidDragSlut}
          />
          {!bild && <span className="note beskarare-vantar">Läser bilden…</span>}
        </div>

        <label className="beskarare-zoom">
          Zoom
          <input
            type="range"
            min={minZoom}
            max="4"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={!bild}
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setZoom(minZoom);
              setMitt({ x: 0.5, y: 0.5 });
            }}
            disabled={!bild}
          >
            Visa hela
          </button>
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
