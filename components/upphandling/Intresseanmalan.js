"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_ORD_I_PRESENTATION, raknaOrdIText } from "@/lib/upphandling";
import { UpphandlingFragor } from "@/components/upphandling/UpphandlingInnehall";

function nyckel(ort, kompetens) {
  return `${ort}|${kompetens}`;
}

export default function Intresseanmalan({ u, krav, anmalan, bolagsnamn, fragorOppna }) {
  const router = useRouter();
  const [valda, setValda] = useState(() => new Set((anmalan?.coverage || []).map((t) => nyckel(t.ort, t.kompetens))));
  const [svar, setSvar] = useState(() => Object.fromEntries(krav.map((k) => [k.id, k.uppfylls])));
  const [kapacitet, setKapacitet] = useState(anmalan?.capacity || "");
  const [referens, setReferens] = useState(anmalan?.reference || "");
  const [meddelande, setMeddelande] = useState(anmalan?.message || "");
  const [samarbete, setSamarbete] = useState(Boolean(anmalan?.open_to_partner));
  const [fel, setFel] = useState("");
  const [besked, setBesked] = useState("");
  const [skickar, setSkickar] = useState(false);
  const [fraga, setFraga] = useState("");
  const [fragabesked, setFragabesked] = useState("");

  const antalOrter = useMemo(() => u.cities.filter((o) => u.competences.some((k) => valda.has(nyckel(o, k)))).length, [u, valda]);
  const skaSaknas = krav.some((k) => k.niva === "ska" && !svar[k.id]);
  const ord = raknaOrdIText(meddelande);
  const last = !u.oppen;
  const kanSkicka = !last && valda.size > 0 && !skaSaknas && ord <= MAX_ORD_I_PRESENTATION && !skickar;

  function vaxla(n) {
    setValda((f) => {
      const ny = new Set(f);
      if (ny.has(n)) ny.delete(n);
      else ny.add(n);
      return ny;
    });
  }

  async function skicka(e) {
    e.preventDefault();
    setFel("");
    setBesked("");
    setSkickar(true);
    const tackning = u.cities.flatMap((ort) =>
      u.competences.filter((k) => valda.has(nyckel(ort, k))).map((kompetens) => ({ ort, kompetens }))
    );
    const res = await fetch("/api/mina-sidor/upphandling/intresse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upphandlingId: u.id, tackning, svar, kapacitet, referens, meddelande, samarbete }),
    });
    const data = await res.json().catch(() => ({}));
    setSkickar(false);
    if (!res.ok) return setFel(data.error || "Något gick fel. Försök igen.");
    setBesked(data.ny ? "Intresseanmälan skickad. Köparen ser nu vad ni kan leverera." : "Ändringarna är sparade.");
    router.refresh();
  }

  async function dragTillbaka() {
    setFel("");
    const res = await fetch(`/api/mina-sidor/upphandling/intresse?upphandling=${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setFel(data.error || "Kunde inte ta bort anmälan.");
    }
    setValda(new Set());
    setBesked("Anmälan är borttagen.");
    router.refresh();
  }

  async function skickaFraga(e) {
    e.preventDefault();
    setFragabesked("");
    const res = await fetch("/api/mina-sidor/upphandling/fraga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upphandlingId: u.id, fraga }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setFragabesked(data.error || "Kunde inte skicka frågan.");
    setFraga("");
    setFragabesked("Frågan är skickad. Svaret visas här när köparen har svarat.");
  }

  return (
    <>
      <UpphandlingFragor fragor={u.fragor}>
        {fragorOppna && (
          <form onSubmit={skickaFraga} style={{ marginTop: 14 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label htmlFor="upp-fraga">Ställ en fråga</label>
              <textarea id="upp-fraga" rows={2} maxLength={500} value={fraga} onChange={(e) => setFraga(e.target.value)} required />
            </div>
            <button className="btn btn-ghost" style={{ flex: "none" }} type="submit">Skicka frågan</button>
            {fragabesked && <p className="upp-not" role="status">{fragabesked}</p>}
          </form>
        )}
      </UpphandlingFragor>

      <form className="upp-staplad" onSubmit={skicka}>
        <section className="auth-panel">
          <h2 className="upp-rubrik-liten">{anmalan ? "Er anmälan" : "Anmäl intresse"}</h2>
          <p className="upp-not">
            Anmälan görs för {bolagsnamn}. Markera varje kombination ni kan leverera. Det räcker med en del av uppdraget.
          </p>
          <div className="upp-matris-ram">
            <table className="upp-matris">
              <thead>
                <tr>
                  <th scope="col"><span className="upp-dold">Ort</span></th>
                  {u.competences.map((k) => (
                    <th scope="col" key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {u.cities.map((ort) => (
                  <tr key={ort}>
                    <th scope="row">{ort}</th>
                    {u.competences.map((k) => {
                      const n = nyckel(ort, k);
                      const pa = valda.has(n);
                      return (
                        <td key={k}>
                          <button
                            type="button"
                            className={`upp-ruta ${pa ? "flera" : "av"}`}
                            aria-pressed={pa}
                            aria-label={`${k} i ${ort}`}
                            disabled={last}
                            onClick={() => vaxla(n)}
                          >
                            {pa ? "Ja" : "Nej"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="upp-not">{antalOrter} av {u.cities.length} orter, {valda.size} av {u.cities.length * u.competences.length} kombinationer.</p>
        </section>

        {krav.length > 0 && (
          <section className="auth-panel">
            <h2 className="upp-rubrik-liten">Krav</h2>
            <p className="upp-not">Det som står i er profil är redan ifyllt. Resten bekräftar ni här.</p>
            {krav.map((k) => (
              <div className="upp-kravrad" key={k.id}>
                <div>
                  <div>{k.text}</div>
                  <div className="card-city">
                    {k.niva === "ska" ? "Ska-krav" : "Bör-krav"}{k.kalla === "profil" ? ", hämtat från er profil" : ""}
                  </div>
                </div>
                <label className="upp-kryss">
                  <input
                    type="checkbox"
                    checked={Boolean(svar[k.id])}
                    disabled={k.kalla === "profil" || last}
                    onChange={(e) => setSvar((s) => ({ ...s, [k.id]: e.target.checked }))}
                  />
                  Uppfylls
                </label>
              </div>
            ))}
          </section>
        )}

        <section className="auth-panel">
          <h2 className="upp-rubrik-liten">Kapacitet och presentation</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="upp-kapacitet">Kapacitet</label>
              <input id="upp-kapacitet" value={kapacitet} maxLength={120} placeholder="12 konsulter inom två veckor" onChange={(e) => setKapacitet(e.target.value)} disabled={last} />
            </div>
            <div className="field">
              <label htmlFor="upp-referens">Liknande uppdrag</label>
              <input id="upp-referens" value={referens} maxLength={200} placeholder="Bransch och år" onChange={(e) => setReferens(e.target.value)} disabled={last} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="upp-meddelande">Varför just ni?</label>
            <textarea id="upp-meddelande" rows={4} value={meddelande} onChange={(e) => setMeddelande(e.target.value)} disabled={last} />
            <p className={ord > MAX_ORD_I_PRESENTATION ? "field-error" : "hint"}>{ord} av {MAX_ORD_I_PRESENTATION} ord</p>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={samarbete} disabled={last} onChange={(e) => setSamarbete(e.target.checked)} />
              Vi är öppna för att samarbeta med en underleverantör på orter vi inte täcker
            </label>
          </div>
        </section>

        <section className="auth-panel">
          {last ? (
            <p className="upp-brod">Upphandlingen är stängd och anmälan kan inte längre ändras.</p>
          ) : (
            <>
              {skaSaknas && <p className="upp-varning">Alla ska-krav måste vara uppfyllda för att ni ska kunna anmäla intresse.</p>}
              {fel && <p className="field-error" role="alert">{fel}</p>}
              {besked && <p className="upp-matchar" role="status">{besked}</p>}
              <button className="qs-btn" type="submit" disabled={!kanSkicka}>
                {skickar ? "Skickar..." : anmalan ? "Spara ändringarna" : "Skicka intresseanmälan"}
              </button>
              {anmalan && (
                <button type="button" className="link-btn" style={{ marginTop: 12 }} onClick={dragTillbaka}>
                  Dra tillbaka anmälan
                </button>
              )}
              <p className="upp-not">Köparen ser anmälan och din e-postadress. Andra leverantörer ser ingenting.</p>
            </>
          )}
        </section>
      </form>
    </>
  );
}
