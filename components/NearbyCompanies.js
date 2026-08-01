"use client";

import { useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { distanceKm } from "@/lib/helpers";

export default function NearbyCompanies() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!address.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q=${encodeURIComponent(
        `${address}, Sverige`
      )}`;
      const res = await fetch(url, { headers: { "Accept-Language": "sv" } });
      if (!res.ok) throw new Error("Kunde inte slå upp adressen just nu. Försök igen om en stund.");
      const data = await res.json();
      if (!data.length) throw new Error("Kunde inte hitta adressen. Testa att skriva den mer specifikt.");

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const sorted = COMPANIES.filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({ company: c, distanceKm: distanceKm(lat, lng, c.lat, c.lng) }))
        .sort((a, b) => a.distanceKm - b.distanceKm);

      setResults(sorted);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Något gick fel vid sökningen.");
    }
  }

  return (
    <div className="nearby-widget">
      <form className="field-row" onSubmit={handleSearch} style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 3, marginBottom: 20 }}>
          <label htmlFor="nearby-address">Din adress</label>
          <input
            id="nearby-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="T.ex. Kungsgatan 1, Göteborg"
          />
        </div>
        <button
          className="btn btn-primary"
          style={{ flex: "none", padding: "12px 24px", marginBottom: 20 }}
          type="submit"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Söker…" : "Sök"}
        </button>
      </form>

      {status === "error" && <div className="flow-error">{errorMsg}</div>}

      {status === "done" && results && (
        <div className="nearby-results">
          <p className="sub">
            <b>{results.length}</b> bolag, närmast först.
          </p>
          {results.map(({ company, distanceKm: d }) => (
            <div className="flow-suggest-card" key={company.id}>
              <div style={{ flex: 1 }}>
                <div className="fs-name">{company.name}</div>
                <div className="fs-meta">
                  {company.city.toUpperCase()} &middot; {d.toFixed(1)} KM BORT
                </div>
              </div>
              <Link className="btn btn-ghost" style={{ flex: "none" }} href={`/bolag/${company.id}`}>
                Se profil
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
