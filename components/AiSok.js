"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { detaljEtiketter } from "@/lib/forfraganDetaljer";

const MAX_TECKEN = 350;

const EXEMPEL = [
  "Ekonomichef i Malmö",
  "Undersköterskor till sommaren",
  "IT-konsult, Stockholm",
];

// AI-sökfältet. Besökaren skriver med egna ord, /api/ai-sok tolkar texten till
// kvickfiltrets värden (yrkesområde, tjänst, ort, antal, start) och besökaren
// skickas vidare. Tolkningen visas kort som etiketter innan sidbytet, så att det
// syns vad sökningen bygger på.
//
// lage:
//   "start"       startsidan, stor, till Rekryteras resultatsida
//   "rekrytera"   Rekrytera, kompakt, till samma resultatsida
//   "upphandling" Upphandling, kompakt, till upphandlingsformuläret, som fyller
//                 i det som gick att tolka (components/upphandling/SkapaUpphandling.js)
const PLATSHALLARE = {
  start: "T.ex. två lagerarbetare i Göteborg med truckkort, start i januari",
  rekrytera: "T.ex. två lagerarbetare i Göteborg med truckkort, start i januari",
  upphandling: "T.ex. bemanning av 40 montörer i Linköping från mars",
};

export default function AiSok({ lage = "start" }) {
  const kompakt = lage !== "start";
  const router = useRouter();
  const [text, setText] = useState("");
  const [laddar, setLaddar] = useState(false);
  const [tolkat, setTolkat] = useState(null);
  const [fel, setFel] = useState("");

  async function sok(e) {
    e?.preventDefault();
    const beskrivning = text.trim();
    if (!beskrivning) {
      setFel("Beskriv kortfattat vad ni söker.");
      return;
    }
    setFel("");
    setLaddar(true);

    let svar = { omrade: "", tjanst: "", ort: "" };
    try {
      const res = await fetch("/api/ai-sok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: beskrivning }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setFel(data.error || "För många sökningar. Försök igen om en stund.");
        setLaddar(false);
        return;
      }
      if (res.ok) svar = data;
    } catch {
      // Nätverksfel: sök ändå, med bara texten.
    }

    const params = new URLSearchParams({ beskrivning: beskrivning.slice(0, MAX_TECKEN) });
    const mal = lage === "upphandling" ? "/upphandling/skapa" : "/rekrytera/resultat";
    if (svar.omrade) params.set("omrade", svar.omrade);
    if (svar.tjanst) params.set("tjanst", svar.tjanst);
    if (svar.ort) params.set("ort", svar.ort);
    if (svar.antal) params.set("antal", String(svar.antal));
    if (svar.start) params.set("start", svar.start);
    // Talar om för förfrågan att värdena kommer från AI:n, så att de markeras
    // som förifyllda tills köparen ändrar dem.
    if (svar.tolkad) params.set("ai", "1");

    const etiketter = [svar.omrade, svar.ort, svar.tjanst, ...detaljEtiketter(svar)].filter(Boolean);
    const url = `${mal}?${params.toString()}`;
    router.prefetch(url);
    if (etiketter.length) {
      setTolkat(etiketter);
      setTimeout(() => router.push(url), 900);
    } else {
      router.push(url);
    }
  }

  return (
    <form className={`ai-sok${kompakt ? " ai-sok-kompakt" : ""}`} onSubmit={sok}>
      <div className={`ai-sok-ruta${text ? " fokus" : ""}`}>
        <label className="ai-sok-topp" htmlFor={`ai-sok-text-${lage}`}>
          Beskriv vad ni söker <span className="ai-sok-tagg">AI</span>
        </label>
        <textarea
          id={`ai-sok-text-${lage}`}
          rows={kompakt ? 1 : 2}
          maxLength={MAX_TECKEN}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TECKEN))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) sok(e);
          }}
          placeholder={PLATSHALLARE[lage] ?? PLATSHALLARE.start}
        />
        <div className="ai-sok-rad">
          <span className="ai-sok-hint">
            {lage === "upphandling"
              ? "Skriv med egna ord, vi fyller i upphandlingen åt er."
              : "Skriv med egna ord, vi föreslår bolag som matchar."}
          </span>
          <button className="ai-sok-knapp" type="submit" disabled={laddar}>
            {laddar ? "Letar…" : lage === "upphandling" ? "Kom igång →" : "Visa matchningar →"}
          </button>
        </div>
      </div>
      {fel && <p className="ai-sok-fel" role="alert">{fel}</p>}
      {tolkat ? (
        <div className="ai-sok-tolkat" aria-live="polite">
          Tolkat som:
          {tolkat.map((t) => <span key={t} className="t">{t}</span>)}
        </div>
      ) : kompakt ? null : (
        <div className="ai-sok-exempel">
          <span>Prova:</span>
          {EXEMPEL.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
      )}
      {!kompakt && (
        <div className="ai-sok-alt">
          Vill du hellre välja själv? <Link href="/rekrytera">Använd kvickfiltret</Link> · <a href="#sa-funkar-det">Så funkar det</a>
        </div>
      )}
    </form>
  );
}
