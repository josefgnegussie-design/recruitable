"use client";

import { useRef, useState } from "react";
import {
  ersattBeskuren,
  garAttRamaOm,
  hamtaOriginalBlob,
  kontrolleraBild,
  uploadCompanyImage,
} from "@/lib/uploadImage";
import BildBeskarare from "@/components/admin/BildBeskarare";

export const MAX_BILDER = 5;

// Bildspelet på bolagets profil. Till skillnad från ImageUploadField, som håller
// ett enda värde, är det här en ordnad lista — ordningen är den besökaren ser,
// så bilderna går att flytta utan att laddas upp på nytt.
export default function BildspelField({ companyId, value = [], onChange }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  // Filerna köas och placeras en i taget i beskäraren.
  const [ko, setKo] = useState([]);
  // Bilden som ramas om: index i listan och originalet att beskära ur.
  const [ramarOm, setRamarOm] = useState(null);

  const fullt = value.length >= MAX_BILDER;

  function handleFiles(e) {
    const filer = [...(e.target.files || [])];
    if (inputRef.current) inputRef.current.value = "";
    if (!filer.length) return;

    setError("");

    // Fler markerade än vad som får plats laddas inte upp alls — att tyst spara
    // de första och slänga resten ser ut som att uppladdningen misslyckats.
    const plats = MAX_BILDER - value.length;
    if (filer.length > plats) {
      setError(`Det får plats ${plats} bild${plats === 1 ? "" : "er"} till.`);
      return;
    }

    try {
      filer.forEach(kontrolleraBild);
    } catch (err) {
      setError(err.message);
      return;
    }

    // Köas i stället för att laddas upp direkt: varje bild ska placeras för sig
    // i beskäraren innan den sparas.
    setKo(filer);
  }

  async function sparaBeskuren(blob) {
    const [fil, ...kvar] = ko;
    setStatus("laddar");
    try {
      const url = await uploadCompanyImage(fil, companyId, "bildspel", blob);
      onChange([...value, url]);
      setKo(kvar);
    } catch (err) {
      setError(err.message);
      setKo([]);
    } finally {
      setStatus("idle");
    }
  }

  // Utgår från originalet när det finns, så en omframning inte beskär en redan
  // beskuren bild. Saknas det duger den beskurna — man kan flytta sig inom den,
  // bara inte zooma ut förbi det tidigare utsnittet.
  async function borjaRamaOm(index) {
    setError("");
    setStatus("laddar");
    try {
      const blob = await hamtaOriginalBlob(value[index]);
      setRamarOm({ index, blob });
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function sparaOmframning(blob) {
    const { index } = ramarOm;
    setStatus("laddar");
    try {
      const url = await ersattBeskuren(value[index], blob);
      onChange(value.map((u, i) => (i === index ? url : u)));
    } catch (err) {
      setError(err.message);
    } finally {
      setRamarOm(null);
      setStatus("idle");
    }
  }

  function taBort(index) {
    onChange(value.filter((_, i) => i !== index));
  }

  function flytta(index, steg) {
    const mal = index + steg;
    if (mal < 0 || mal >= value.length) return;
    const nasta = [...value];
    [nasta[index], nasta[mal]] = [nasta[mal], nasta[index]];
    onChange(nasta);
  }

  return (
    <div className="field">
      <label>Bilder</label>
      <div className="bildspel-rutor">
        {value.map((url, i) => (
          <div className="bildspel-ruta" key={url}>
            <img src={url} alt="" />
            <div className="bildspel-verktyg">
              <button
                type="button"
                onClick={() => flytta(i, -1)}
                disabled={i === 0}
                aria-label="Flytta bilden framåt i ordningen"
              >
                ←
              </button>
              <span>{i + 1}</span>
              <button
                type="button"
                onClick={() => flytta(i, 1)}
                disabled={i === value.length - 1}
                aria-label="Flytta bilden bakåt i ordningen"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => borjaRamaOm(i)}
                disabled={!garAttRamaOm(url) || status === "laddar"}
                aria-label="Beskär om bilden"
                title="Beskär om"
              >
                ⤢
              </button>
              <button type="button" onClick={() => taBort(i)} aria-label="Ta bort bilden">
                ✕
              </button>
            </div>
          </div>
        ))}

        {!fullt && (
          <button
            type="button"
            className="bildspel-ruta tom"
            onClick={() => inputRef.current?.click()}
            disabled={status === "laddar"}
          >
            {status === "laddar" ? "Laddar upp…" : "+ Lägg till"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFiles}
        hidden
      />

      <p className="hint">
        Upp till {MAX_BILDER} bilder — kontoret, teamet, arbetsplatsen. Visas som bildspel på er
        profil i den ordning de ligger här. JPG, PNG eller WEBP, max 5 MB per bild.
      </p>
      {error && <p className="field-error">{error}</p>}

      {ko.length > 0 && (
        <BildBeskarare
          fil={ko[0]}
          typ="bildspel"
          onKlar={sparaBeskuren}
          onAvbryt={() => setKo([])}
        />
      )}

      {ramarOm && (
        <BildBeskarare
          fil={ramarOm.blob}
          typ="bildspel"
          onKlar={sparaOmframning}
          onAvbryt={() => setRamarOm(null)}
        />
      )}
    </div>
  );
}
