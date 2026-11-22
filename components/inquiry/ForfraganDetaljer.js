"use client";

import { YRKESOMRADEN, TJANSTER } from "@/lib/taxonomy";
import { MAX_ANTAL } from "@/lib/forfraganDetaljer";

const AI = <span className="ff-ai" title="Ifyllt från din sökning">AI</span>;

// Rutan "Er förfrågan" i steg 2: det bolagen får läsa om behovet. Fält som
// AI-sökningen fyllt i har en orange ton och en AI-etikett tills besökaren
// ändrar dem. Samma menyer som kvickfiltret, så att ett tömt fält går att
// välja om på vanligt sätt.
export default function ForfraganDetaljer({ behov, aiFalt, andra, starter, orter }) {
  const ai = (falt) => aiFalt.has(falt);
  const klass = (falt, hel) => `field${hel ? " hel" : ""}${ai(falt) ? " ai-fylld" : ""}`;
  const etikett = (id, text, falt) => (
    <label htmlFor={id}>
      {text} {ai(falt) && AI}
    </label>
  );

  return (
    <section className="auth-panel ff-panel" aria-labelledby="ff-rubrik">
      <div className="ff-topp">
        <h2 className="ff-rubrik" id="ff-rubrik">Er förfrågan</h2>
        {aiFalt.size > 0 && <span className="ff-not">{AI} = ifyllt från din sökning</span>}
      </div>
      <div className="ff-grid">
        <div className={klass("beskrivning", true)}>
          {etikett("ff-beskrivning", "Beskrivning", "beskrivning")}
          <textarea
            id="ff-beskrivning"
            rows={3}
            maxLength={350}
            value={behov.beskrivning}
            onChange={(e) => andra("beskrivning", e.target.value.slice(0, 350))}
            placeholder="T.ex. roll, omfattning och annat som är bra för bolagen att veta."
          />
        </div>
        <div className={klass("omrade", true)}>
          {etikett("ff-omrade", "Yrkesområde", "omrade")}
          <select id="ff-omrade" value={behov.omrade} onChange={(e) => andra("omrade", e.target.value)}>
            <option value="">Välj yrkesområde</option>
            {Object.keys(YRKESOMRADEN).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className={klass("service")}>
          {etikett("ff-tjanst", "Tjänst", "service")}
          <select id="ff-tjanst" value={behov.service} onChange={(e) => andra("service", e.target.value)}>
            <option value="">Välj tjänst</option>
            {TJANSTER.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className={klass("ort")}>
          {etikett("ff-ort", "Arbetsort", "ort")}
          <input
            id="ff-ort"
            type="text"
            list="ff-ort-lista"
            autoComplete="off"
            maxLength={100}
            placeholder="Alla orter"
            value={behov.ort}
            onChange={(e) => andra("ort", e.target.value)}
          />
          <datalist id="ff-ort-lista">
            {orter.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div className={klass("antal")}>
          {etikett("ff-antal", "Antal personer", "antal")}
          <input
            id="ff-antal"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_ANTAL}
            placeholder="Valfritt"
            value={behov.antal}
            onChange={(e) => andra("antal", e.target.value)}
          />
        </div>
        <div className={klass("start")}>
          {etikett("ff-start", "Start", "start")}
          <select id="ff-start" value={behov.start} onChange={(e) => andra("start", e.target.value)}>
            <option value="">Valfritt</option>
            {starter.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </section>
  );
}
