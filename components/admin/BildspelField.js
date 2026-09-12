"use client";

import { useRef, useState } from "react";
import { uploadCompanyImage } from "@/lib/uploadImage";

export const MAX_BILDER = 5;

// Bildspelet på bolagets profil. Till skillnad från ImageUploadField, som håller
// ett enda värde, är det här en ordnad lista — ordningen är den besökaren ser,
// så bilderna går att flytta utan att laddas upp på nytt.
export default function BildspelField({ companyId, value = [], onChange }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const fullt = value.length >= MAX_BILDER;

  async function handleFiles(e) {
    const filer = [...(e.target.files || [])];
    if (!filer.length) return;

    setStatus("laddar");
    setError("");

    // Fler markerade än vad som får plats laddas inte upp alls — att tyst spara
    // de tre första och slänga resten ser ut som att uppladdningen misslyckats.
    const plats = MAX_BILDER - value.length;
    if (filer.length > plats) {
      setError(`Det får plats ${plats} bild${plats === 1 ? "" : "er"} till.`);
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      const nya = [];
      for (const fil of filer) {
        nya.push(await uploadCompanyImage(fil, companyId, "bildspel"));
      }
      onChange([...value, ...nya]);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
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
    </div>
  );
}
