"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { distanceKm } from "@/lib/helpers";

function suggestionLabel(item) {
  const a = item.address || {};
  const ort = a.city || a.town || a.village || a.municipality || a.suburb || a.county || "";
  const gata = [a.road, a.house_number].filter(Boolean).join(" ");
  if (gata && ort) return `${gata}, ${ort}`;
  if (ort) return `${item.display_name.split(",")[0]}, ${ort}`;
  return item.display_name;
}

export default function NearbyCompanies() {
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState(null);

  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleAddressChange(e) {
    const val = e.target.value;
    setAddress(val);
    setSelectedCoords(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        // Strukturerad sökning (street=) ger träffar spridda över flera orter för samma
        // gatunamn (t.ex. "Storgatan 1" i både Stockholm och Göteborg) — fritextsökning
        // (q=) ger bara en enda "bästa gissning" och döljer den tvetydigheten.
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=se&street=${encodeURIComponent(
          val
        )}`;
        const res = await fetch(url, { headers: { "Accept-Language": "sv" } });
        if (!res.ok) return;
        const data = await res.json();
        const seen = new Set();
        const deduped = data.filter((item) => {
          const label = suggestionLabel(item);
          if (seen.has(label)) return false;
          seen.add(label);
          return true;
        });
        setSuggestions(deduped);
        setShowSuggestions(deduped.length > 0);
      } catch {
        // Förslag är en bonusfunktion — misslyckas det tyst, går det ändå att söka på fritext.
      }
    }, 350);
  }

  function pickSuggestion(item) {
    setAddress(suggestionLabel(item));
    setSelectedCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!address.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    setShowSuggestions(false);
    try {
      let lat, lng;
      if (selectedCoords) {
        ({ lat, lng } = selectedCoords);
      } else {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=se&q=${encodeURIComponent(
          `${address}, Sverige`
        )}`;
        const res = await fetch(url, { headers: { "Accept-Language": "sv" } });
        if (!res.ok) throw new Error("Kunde inte slå upp adressen just nu. Försök igen om en stund.");
        const data = await res.json();
        if (!data.length) throw new Error("Kunde inte hitta adressen. Testa att skriva den mer specifikt.");
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
      }

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
      <form className="field-row" onSubmit={handleSearch} style={{ alignItems: "flex-end" }} autoComplete="off">
        <div className="field nearby-autocomplete" style={{ flex: 3, marginBottom: 20 }} ref={wrapRef}>
          <label htmlFor="nearby-address">Din adress</label>
          <input
            id="nearby-address"
            type="text"
            value={address}
            onChange={handleAddressChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="T.ex. Storgatan 1, Göteborg"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="nearby-suggest-list">
              {suggestions.map((s) => (
                <li key={s.place_id} onClick={() => pickSuggestion(s)}>
                  {suggestionLabel(s)}
                </li>
              ))}
            </ul>
          )}
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
