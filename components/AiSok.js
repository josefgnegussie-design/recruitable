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

// Startsidans sökfält. Besökaren skriver med egna ord, /api/ai-sok tolkar texten
// till kvickfiltrets värden (yrkesområde, tjänst, ort) och besökaren skickas
// till samma resultatsida som kvickfiltret leder till. Tolkningen visas kort som
// etiketter innan sidbytet, så att det syns vad sökningen bygger på.
export default function AiSok() {
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
    if (svar.omrade) params.set("omrade", svar.omrade);
    if (svar.tjanst) params.set("tjanst", svar.tjanst);
    if (svar.ort) params.set("ort", svar.ort);
    if (svar.antal) params.set("antal", String(svar.antal));
    if (svar.start) params.set("start", svar.start);
    // Talar om för förfrågan att värdena kommer från AI:n, så att de markeras
    // som förifyllda tills köparen ändrar dem.
    if (svar.tolkad) params.set("ai", "1");

    const etiketter = [svar.omrade, svar.ort, svar.tjanst, ...detaljEtiketter(svar)].filter(Boolean);
    const url = `/rekrytera/resultat?${params.toString()}`;
    router.prefetch(url);
    if (etiketter.length) {
      setTolkat(etiketter);
      setTimeout(() => router.push(url), 900);
    } else {
      router.push(url);
    }
  }

  return (
    <form className="ai-sok" onSubmit={sok}>
      <div className={`ai-sok-ruta${text ? " fokus" : ""}`}>
        <label className="ai-sok-topp" htmlFor="ai-sok-text">
          Beskriv vad ni söker <span className="ai-sok-tagg">AI</span>
        </label>
        <textarea
          id="ai-sok-text"
          rows={2}
          maxLength={MAX_TECKEN}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TECKEN))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) sok(e);
          }}
          placeholder="T.ex. två lagerarbetare i Göteborg med truckkort, start i januari"
        />
        <div className="ai-sok-rad">
          <span className="ai-sok-hint">Skriv med egna ord, vi föreslår bolag som matchar.</span>
          <button className="ai-sok-knapp" type="submit" disabled={laddar}>
            {laddar ? "Letar…" : "Visa matchningar →"}
          </button>
        </div>
      </div>
      {fel && <p className="ai-sok-fel" role="alert">{fel}</p>}
      {tolkat ? (
        <div className="ai-sok-tolkat" aria-live="polite">
          Tolkat som:
          {tolkat.map((t) => <span key={t} className="t">{t}</span>)}
        </div>
      ) : (
        <div className="ai-sok-exempel">
          <span>Prova:</span>
          {EXEMPEL.map((ex) => (
            <button key={ex} type="button" onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
      )}
      <div className="ai-sok-alt">
        Vill du hellre välja själv? <Link href="/rekrytera">Använd kvickfiltret</Link> · <a href="#sa-funkar-det">Så funkar det</a>
      </div>
    </form>
  );
}
