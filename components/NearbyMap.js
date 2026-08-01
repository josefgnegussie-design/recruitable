"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { companiesWithinRadius } from "@/lib/helpers";

const RADIUS_KM = 25;
const SWEDEN_CENTER = { lat: 62.0, lng: 15.0 };
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function NearbyMap() {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const overlaysRef = useRef([]);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;
    const loader = new Loader({ apiKey: API_KEY, version: "weekly" });
    loader
      .load()
      .then((google) => {
        if (cancelled || !mapElRef.current) return;
        googleRef.current = google;
        mapRef.current = new google.maps.Map(mapElRef.current, {
          center: SWEDEN_CENTER,
          zoom: 4,
          streetViewControl: false,
          mapTypeControl: false,
        });
        setMapReady(true);
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message || "Kunde inte ladda Google Maps.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function clearOverlays() {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!address.trim() || !mapReady) return;
    const google = googleRef.current;
    setStatus("loading");
    setErrorMsg("");
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: `${address}, Sverige` }, (results, geoStatus) => {
          if (geoStatus === "OK" && results[0]) resolve(results[0]);
          else reject(new Error("Kunde inte hitta adressen. Testa att skriva den mer specifikt."));
        });
      });

      const loc = result.geometry.location;
      const lat = loc.lat();
      const lng = loc.lng();
      const found = companiesWithinRadius(COMPANIES, lat, lng, RADIUS_KM);

      mapRef.current.setCenter({ lat, lng });
      mapRef.current.setZoom(10);
      clearOverlays();

      overlaysRef.current.push(
        new google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
          title: "Din adress",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#d97b3f",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        })
      );

      overlaysRef.current.push(
        new google.maps.Circle({
          center: { lat, lng },
          radius: RADIUS_KM * 1000,
          map: mapRef.current,
          fillColor: "#d97b3f",
          fillOpacity: 0.08,
          strokeColor: "#d97b3f",
          strokeOpacity: 0.4,
          strokeWeight: 1,
        })
      );

      found.forEach(({ company, distanceKm }) => {
        overlaysRef.current.push(
          new google.maps.Marker({
            position: { lat: company.lat, lng: company.lng },
            map: mapRef.current,
            title: `${company.name} (${distanceKm.toFixed(1)} km)`,
          })
        );
      });

      setMatches(found);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Något gick fel vid sökningen.");
    }
  }

  return (
    <div className="nearby-map-widget">
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
          disabled={!mapReady || status === "loading"}
        >
          {status === "loading" ? "Söker…" : `Visa bolag inom ${RADIUS_KM} km`}
        </button>
      </form>

      {status === "error" && <div className="flow-error">{errorMsg}</div>}

      {!API_KEY ? (
        <div className="nearby-map-placeholder">
          Google Maps-kartan kräver en API-nyckel. Lägg till <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> i en{" "}
          <code>.env.local</code>-fil (se README) för att aktivera den här widgeten.
        </div>
      ) : (
        <>
          {mapError && <div className="flow-error">{mapError}</div>}
          <div ref={mapElRef} className="nearby-map-canvas"></div>
        </>
      )}

      {status === "done" && (
        <div className="nearby-map-results">
          <p className="sub">
            <b>{matches.length}</b> bolag inom {RADIUS_KM} km från din adress.
          </p>
          {matches.length === 0 ? (
            <p className="sub">Inga bolag i registret ligger inom {RADIUS_KM} km — testa en annan adress.</p>
          ) : (
            matches.map(({ company, distanceKm }) => (
              <div className="flow-suggest-card" key={company.id}>
                <div style={{ flex: 1 }}>
                  <div className="fs-name">{company.name}</div>
                  <div className="fs-meta">
                    {company.city.toUpperCase()} &middot; {distanceKm.toFixed(1)} KM BORT
                  </div>
                </div>
                <Link className="btn btn-ghost" style={{ flex: "none" }} href={`/bolag/${company.id}`}>
                  Se profil
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
