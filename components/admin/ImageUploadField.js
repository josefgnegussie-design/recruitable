"use client";

import { useRef, useState } from "react";
import { uploadCompanyImage } from "@/lib/uploadImage";

export default function ImageUploadField({ label, companyId, folder, value, onChange, shape = "rect" }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setError("");
    try {
      const url = await uploadCompanyImage(file, companyId, folder);
      onChange(url);
      setStatus("idle");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
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
          {value && (
            <button type="button" className="btn btn-ghost" onClick={() => onChange("")}>
              Ta bort
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
