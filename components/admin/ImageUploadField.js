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

export default function ImageUploadField({ label, companyId, folder, value, onChange, shape = "rect" }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  // Filen väntar här medan användaren placerar den i beskäraren.
  const [valdFil, setValdFil] = useState(null);
  // Originalet till den sparade bilden, när den ramas om.
  const [omframning, setOmframning] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setError("");
    try {
      kontrolleraBild(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    setValdFil(file);
  }

  // Utgår från originalet när det finns, så en omframning inte beskär en redan
  // beskuren bild.
  async function borjaRamaOm() {
    setError("");
    setStatus("uploading");
    try {
      setOmframning(await hamtaOriginalBlob(value));
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function sparaOmframning(blob) {
    setStatus("uploading");
    try {
      onChange(await ersattBeskuren(value, blob));
    } catch (err) {
      setError(err.message);
    } finally {
      setOmframning(null);
      setStatus("idle");
    }
  }

  async function sparaBeskuren(blob) {
    setStatus("uploading");
    try {
      const url = await uploadCompanyImage(valdFil, companyId, folder, blob);
      onChange(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setValdFil(null);
      setStatus("idle");
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="image-upload">
        <div className={`image-upload-preview ${shape === "circle" ? "circle" : ""}`}>
          {value ? <img src={value} alt="" /> : <span className="image-upload-placeholder">Ingen bild</span>}
        </div>
        <div className="image-upload-actions">
          <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={status === "uploading"}>
            {status === "uploading" ? "Laddar upp..." : value ? "Byt bild" : "Ladda upp bild"}
          </button>
          {value && garAttRamaOm(value) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={borjaRamaOm}
              disabled={status === "uploading"}
            >
              Beskär om
            </button>
          )}
          {value && (
            <button type="button" className="btn btn-ghost" onClick={() => onChange("")}>
              Ta bort
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
      </div>
      {error && <p className="field-error">{error}</p>}

      {valdFil && (
        <BildBeskarare
          fil={valdFil}
          typ="logo"
          onKlar={sparaBeskuren}
          onAvbryt={() => setValdFil(null)}
        />
      )}

      {omframning && (
        <BildBeskarare
          fil={omframning}
          typ="logo"
          onKlar={sparaOmframning}
          onAvbryt={() => setOmframning(null)}
        />
      )}
    </div>
  );
}
