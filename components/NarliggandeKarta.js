"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import "maplibre-gl/dist/maplibre-gl.css";

// Karta över registrets bolag runt en eller flera adresser, för den som ska
// rekrytera eller upphandla. Adresserna slås upp på vår egen server
// (app/api/narliggande) i postnummerregistret; kartan själv är MapLibre med
// OpenStreetMap-data. Biblioteket är stort, så det laddas först när kartan
// närmar sig skärmen.
//
// Kartbilderna kommer från MapTiler om NEXT_PUBLIC_MAPTILER_KEY är satt, annars
// från OpenFreeMap, som inte kräver något konto. Båda bygger på OpenStreetMap.

const MAX_ADRESSER = 5;
const RADIER = [10, 25, 50, 75];
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STIL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz/style.json?key=${MAPTILER_KEY}`
  : "https://tiles.openfreemap.org/styles/positron";

const ORANGE = "#d97b3f";
const NAVY = "#1c4351";
// Över den här zoomnivån slås prickarna inte längre ihop. Bolag på exakt samma
// punkt (samma postnummer) visas då i en lista när man klickar.
const KLUSTER_MAX_ZOOM = 12;
const SVERIGE = [
  [10.5, 55.2],
  [24.5, 69.2],
];

// En cirkel som polygon, för radien runt varje adress.
function cirkel(lat, lng, km, steg = 64) {
  const ring = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steg; i++) {
    const v = (i / steg) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(v), lat + dLat * Math.sin(v)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

// Registret och postnummerregistret har en punkt per postort, så ett bolag på
// samma ort som adressen står på 0 km. Då säger vi "på orten" i stället.
function kmText(km) {
  return km < 1 ? "på orten" : `${km.toLocaleString("sv-SE", { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

// "I Göteborg" eller "58 km från Borås", med ortnamnet i stället för
// adressens nummer, så att raden går att läsa utan att titta på kartan.
function franAdress(km, punkt) {
  const ort = punkt?.ort || punkt?.etikett || "";
  return km < 1 ? `I ${ort}` : `${kmText(km)} från ${ort}`;
}

// Popupens innehåll byggs som DOM och inte som HTML-sträng, så att ett
// bolagsnamn aldrig kan tolkas som kod.
function popupInnehall(bolag) {
  const rot = document.createElement("div");
  rot.className = "nk-popup";
  for (const b of bolag.slice(0, 8)) {
    const rad = document.createElement("div");
    rad.className = "nk-popup-rad";
    const a = document.createElement("a");
    a.href = b.profil;
    a.textContent = b.namn;
    const meta = document.createElement("span");
    meta.textContent = `${b.ort ? `${b.ort} · ` : ""}${kmText(b.km)}`;
    rad.append(a, meta);
    rot.append(rad);
  }
  if (bolag.length > 8) {
    const fler = document.createElement("div");
    fler.className = "nk-popup-fler";
    fler.textContent = `och ${bolag.length - 8} till på samma plats`;
    rot.append(fler);
  }
  return rot;
}

export default function NarliggandeKarta({ lage = "rekrytera" }) {
  const [adresser, setAdresser] = useState([""]);
  const [radie, setRadie] = useState(25);
  const [omrade, setOmrade] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [fel, setFel] = useState("");
  const [svar, setSvar] = useState(null);
  const [kartstatus, setKartstatus] = useState("vilar"); // vilar | laddar | klar | fel
  const [visaAlla, setVisaAlla] = useState(false);
  // Kartan är liten tills besökaren söker eller klickar på den.
  const [oppen, setOppen] = useState(false);

  const ytaRef = useRef(null);
  const kartRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const markorerRef = useRef([]);
  const popupRef = useRef(null);

  // Kartan skapas först när den är nära skärmen: MapLibre är runt 800 kB.
  useEffect(() => {
    const yta = ytaRef.current;
    if (!yta) return;
    let avbruten = false;

    async function skapa() {
      setKartstatus("laddar");
      try {
        const { default: maplibregl } = await import("maplibre-gl");
        if (avbruten || !kartRef.current) return;
        libRef.current = maplibregl;
        const map = new maplibregl.Map({
          container: kartRef.current,
          style: STIL,
          bounds: SVERIGE,
          fitBoundsOptions: { padding: 20 },
          attributionControl: { compact: true },
          cooperativeGestures: true,
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "Håll Ctrl nedtryckt och scrolla för att zooma",
            "CooperativeGesturesHandler.MacHelpText": "Håll ⌘ nedtryckt och scrolla för att zooma",
            "CooperativeGesturesHandler.MobileHelpText": "Använd två fingrar för att flytta kartan",
            "NavigationControl.ZoomIn": "Zooma in",
            "NavigationControl.ZoomOut": "Zooma ut",
            "NavigationControl.ResetBearing": "Återställ riktning",
          },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;

        map.on("load", () => {
          map.addSource("nk-radie", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "nk-radie-yta",
            type: "fill",
            source: "nk-radie",
            paint: { "fill-color": NAVY, "fill-opacity": 0.06 },
          });
          map.addLayer({
            id: "nk-radie-kant",
            type: "line",
            source: "nk-radie",
            paint: { "line-color": NAVY, "line-width": 1.5, "line-dasharray": [2, 2], "line-opacity": 0.6 },
          });

          map.addSource("nk-bolag", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            cluster: true,
            clusterRadius: 36,
            clusterMaxZoom: KLUSTER_MAX_ZOOM,
          });
          map.addLayer({
            id: "nk-kluster",
            type: "circle",
            source: "nk-bolag",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": ORANGE,
              "circle-opacity": 0.9,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
              "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 50, 23],
            },
          });
          map.addLayer({
            id: "nk-kluster-tal",
            type: "symbol",
            source: "nk-bolag",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Noto Sans Bold"],
            },
            paint: { "text-color": "#fff" },
          });
          map.addLayer({
            id: "nk-punkt",
            type: "circle",
            source: "nk-bolag",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ORANGE,
              "circle-radius": ["case", ["boolean", ["feature-state", "vald"], false], 10, 7],
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
            },
          });

          for (const lager of ["nk-kluster", "nk-punkt"]) {
            map.on("mouseenter", lager, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", lager, () => (map.getCanvas().style.cursor = ""));
          }

          map.on("click", "nk-kluster", async (e) => {
            const f = e.features[0];
            const kalla = map.getSource("nk-bolag");
            const id = f.properties.cluster_id;
            const zoom = await kalla.getClusterExpansionZoom(id);
            if (zoom <= KLUSTER_MAX_ZOOM && map.getZoom() < KLUSTER_MAX_ZOOM) {
              map.easeTo({ center: f.geometry.coordinates, zoom });
              return;
            }
            const blad = await kalla.getClusterLeaves(id, 100, 0);
            const bolag = blad.map((b) => b.properties).sort((a, b) => a.km - b.km);
            visaPopup(f.geometry.coordinates, bolag);
          });

          map.on("click", "nk-punkt", (e) => {
            const f = e.features[0];
            visaPopup(f.geometry.coordinates, [f.properties]);
          });

          setKartstatus("klar");
        });

        map.on("error", (e) => {
          // Enstaka kartbilder som inte laddar ska inte fälla kartan. Bara om
          // själva stilen saknas visas reservtexten.
          if (!map.isStyleLoaded() && !map.loaded()) console.error("Kartan kunde inte laddas:", e?.error?.message);
        });
      } catch (err) {
        console.error("Kunde inte ladda kartan:", err);
        if (!avbruten) setKartstatus("fel");
      }
    }

    function visaPopup(lngLat, bolag) {
      const lib = libRef.current;
      const map = mapRef.current;
      if (!lib || !map) return;
      popupRef.current?.remove();
      popupRef.current = new lib.Popup({ offset: 12, maxWidth: "280px" })
        .setLngLat(lngLat)
        .setDOMContent(popupInnehall(bolag))
        .addTo(map);
    }

    const obs = new IntersectionObserver(
      (poster) => {
        if (poster.some((p) => p.isIntersecting)) {
          obs.disconnect();
          skapa();
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(yta);

    return () => {
      avbruten = true;
      obs.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Svaret ritas ut när både kartan och svaret finns, i vilken ordning de än
  // kommer.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (kartstatus !== "klar" || !map || !lib) return;

    for (const m of markorerRef.current) m.remove();
    markorerRef.current = [];
    popupRef.current?.remove();

    const punkter = svar?.punkter ?? [];
    const bolag = svar?.bolag ?? [];

    map.getSource("nk-radie")?.setData({
      type: "FeatureCollection",
      features: punkter.map((p) => cirkel(p.lat, p.lng, svar.radie)),
    });
    map.getSource("nk-bolag")?.setData({
      type: "FeatureCollection",
      features: bolag.map((b, i) => ({
        type: "Feature",
        id: i,
        properties: { namn: b.namn, ort: b.ort, km: b.km, profil: b.profil },
        geometry: { type: "Point", coordinates: [b.lng, b.lat] },
      })),
    });

    punkter.forEach((p, i) => {
      const el = document.createElement("div");
      el.className = "nk-adressnal";
      el.textContent = String(i + 1);
      el.title = p.etikett;
      markorerRef.current.push(new lib.Marker({ element: el, anchor: "bottom", offset: [0, -18] }).setLngLat([p.lng, p.lat]).addTo(map));
    });

  }, [svar, kartstatus]);

  // När kartan fälls ut eller in ändrar den storlek. Vänta ut övergången, låt
  // MapLibre mäta om och passa in adresserna, eller hela Sverige utan sökning.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (kartstatus !== "klar" || !map || !lib) return;
    const t = setTimeout(() => {
      map.resize();
      const punkter = svar?.punkter ?? [];
      if (!punkter.length) {
        map.fitBounds(SVERIGE, { padding: 10, duration: 0 });
        return;
      }
      const granser = new lib.LngLatBounds();
      for (const p of punkter) {
        for (const k of cirkel(p.lat, p.lng, svar.radie, 16).geometry.coordinates[0]) granser.extend(k);
      }
      map.fitBounds(granser, { padding: oppen ? 30 : 8, duration: oppen ? 500 : 0, maxZoom: 13 });
    }, 320);
    return () => clearTimeout(t);
  }, [svar, kartstatus, oppen]);

  function markera(i, pa) {
    const map = mapRef.current;
    if (!map || kartstatus !== "klar") return;
    map.setFeatureState({ source: "nk-bolag", id: i }, { vald: pa });
  }

  function visaPaKartan(b) {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    map.easeTo({ center: [b.lng, b.lat], zoom: Math.max(map.getZoom(), KLUSTER_MAX_ZOOM + 1), duration: 500 });
    popupRef.current?.remove();
    popupRef.current = new lib.Popup({ offset: 12, maxWidth: "280px" })
      .setLngLat([b.lng, b.lat])
      .setDOMContent(popupInnehall([b]))
      .addTo(map);
    ytaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function sok(e) {
    e.preventDefault();
    const lista = adresser.map((a) => a.trim()).filter(Boolean);
    if (!lista.length) {
      setFel("Skriv in minst en adress, ett postnummer eller en ort.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setFel("");
    setVisaAlla(false);
    try {
      const res = await fetch("/api/narliggande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adresser: lista, radie, omrade }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sökningen gick inte att göra just nu. Försök igen om en stund.");
      if (!data.punkter.length) {
        throw new Error("Vi hittade inte adressen. Skriv med postnummer, till exempel Storgatan 1, 411 38 Göteborg.");
      }
      setSvar({ ...data, radie, omrade });
      setStatus("done");
      setOppen(true);
    } catch (err) {
      setStatus("error");
      setFel(err.message);
    }
  }

  function andra(i, v) {
    setAdresser((a) => a.map((x, j) => (j === i ? v : x)));
  }

  const bolag = svar?.bolag ?? [];
  const synliga = visaAlla ? bolag : bolag.slice(0, 12);
  const forstaOrt = svar?.punkter?.[0]?.ort ?? "";

  const vidare =
    lage === "upphandling"
      ? { href: "/upphandling/skapa", text: "Hitta bolag för er upphandling" }
      : {
          href: `/rekrytera/resultat?${new URLSearchParams({
            ...(forstaOrt ? { ort: forstaOrt } : {}),
            ...(svar?.omrade ? { omrade: svar.omrade } : {}),
          })}`,
          text: forstaOrt ? `Skicka en förfrågan till bolag i ${forstaOrt}` : "Skicka en förfrågan",
        };

  return (
    <div className={`nk${oppen ? " nk-oppen" : ""}`}>
      <form className="nk-form" onSubmit={sok} autoComplete="off">
        {adresser.map((a, i) => (
          <div className="nk-adress-rad" key={i}>
            <span className="nk-nr" aria-hidden="true">
              {i + 1}
            </span>
            <input
              id={`nk-adress-${i}`}
              type="text"
              value={a}
              maxLength={120}
              aria-label={`Adress ${i + 1}`}
              onChange={(e) => andra(i, e.target.value)}
              placeholder={i === 0 ? "Adress, postnummer eller ort" : "Ytterligare en adress"}
            />
            {adresser.length > 1 && (
              <button
                type="button"
                className="nk-ta-bort"
                aria-label={`Ta bort adress ${i + 1}`}
                onClick={() => setAdresser((x) => x.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <div className="nk-val">
          {adresser.length < MAX_ADRESSER && (
            <button type="button" className="nk-lank" onClick={() => setAdresser((x) => [...x, ""])}>
              + Adress
            </button>
          )}
          <select aria-label="Avstånd" className="nk-tyst" value={radie} onChange={(e) => setRadie(Number(e.target.value))}>
            {RADIER.map((r) => (
              <option key={r} value={r}>
                Inom {r} km
              </option>
            ))}
          </select>
          <select aria-label="Yrkesområde" className="nk-tyst" value={omrade} onChange={(e) => setOmrade(e.target.value)}>
            <option value="">Alla yrkesområden</option>
            {Object.keys(YRKESOMRADEN).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button className="nk-sok" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Söker…" : "Visa"}
          </button>
        </div>
        {status === "error" && fel && <p className="nk-fel">{fel}</p>}
      </form>

      <div className="nk-yta" ref={ytaRef}>
        <div className="nk-karta-ram">
          <div className="nk-karta" ref={kartRef} role="region" aria-label="Karta över bolag nära adresserna" />
          {!oppen && (
            <button type="button" className="nk-oppna" onClick={() => setOppen(true)}>
              <span>Öppna kartan</span>
            </button>
          )}
          {oppen && (
            <button type="button" className="nk-stang" onClick={() => setOppen(false)} aria-label="Minimera kartan">
              Minimera
            </button>
          )}
          {kartstatus === "fel" && oppen && <div className="nk-karta-tom">Kartan gick inte att ladda.</div>}
        </div>

        {oppen && (
          <aside className="nk-lista" aria-live="polite">
            {!svar && <p className="nk-lista-tom">Skriv in en adress, så visas bolagen runt den här, närmast först.</p>}
            {svar && (
              <>
                <div className="nk-lista-huvud">
                  <b>{svar.totalt.toLocaleString("sv-SE")}</b> bolag inom {svar.radie} km
                  {svar.punkter.length === 1 ? ` från ${svar.punkter[0].etikett}` : ""}
                </div>
                {svar.ejHittade.length > 0 && (
                  <p className="nk-ej">Hittade inte {svar.ejHittade.join(", ")}. Prova med postnummer.</p>
                )}
                {bolag.length === 0 && <p className="nk-lista-tom">Inga bolag här. Prova ett större avstånd.</p>}
                <ul className="nk-bolag">
                  {synliga.map((b, i) => (
                    <li key={b.id} onMouseEnter={() => markera(i, true)} onMouseLeave={() => markera(i, false)}>
                      <button type="button" className="nk-bolag-knapp" onClick={() => visaPaKartan(b)}>
                        <span className="nk-bolag-namn">{b.namn}</span>
                        <span className="nk-bolag-meta">
                          {svar.punkter.length > 1
                            ? b.perAdress.map((km, j) => franAdress(km, svar.punkter[j])).join(" · ")
                            : `${b.ort} · ${kmText(b.km)}`}
                        </span>
                      </button>
                      <Link className="nk-profil" href={b.profil} aria-label={`Profil för ${b.namn}`}>
                        →
                      </Link>
                    </li>
                  ))}
                </ul>
                {bolag.length > synliga.length && (
                  <button type="button" className="nk-lank" onClick={() => setVisaAlla(true)}>
                    Visa alla {bolag.length}
                  </button>
                )}
                {bolag.length > 0 && (
                  <Link className="nk-vidare" href={vidare.href}>
                    {vidare.text} →
                  </Link>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
