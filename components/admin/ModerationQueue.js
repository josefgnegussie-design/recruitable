"use client";

import { useState } from "react";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

export default function ModerationQueue({ initialQueue, initialGodkanda = [] }) {
  const [queue, setQueue] = useState(initialQueue);
  const [godkanda, setGodkanda] = useState(initialGodkanda);
  // Tillbakadragningen har ett andra klick: den tar bort förfrågan från bolag
  // som kanske redan svarat, och går inte att ångra härifrån.
  const [bekraftaDra, setBekraftaDra] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [kvitto, setKvitto] = useState("");

  // Godkännandet mejlar bolagen, och kortet försvinner i samma ögonblick ur kön.
  // Utan en kvittorad hade det inte gått att se att de flesta valda bolagen inte
  // fick något mejl — de allra flesta i registret har ännu inte tagit över sin
  // profil, och det är en uppgift om verkligheten, inte ett fel.
  function kvittotext(decision, data) {
    if (decision === "withdrawn") return "Förfrågan dragen tillbaka. Den syns inte längre för bolagen.";
    if (decision !== "approved") return "Förfrågan nekad. Inget bolag har informerats.";
    const mejlade = data?.mejlade ?? 0;
    const utan = data?.utanMottagare ?? 0;
    if (!mejlade) {
      return utan
        ? `Godkänd och synlig på Mina sidor. Inget mejl gick ut — inget av de ${utan} valda bolagen har en registrerad profil med kontaktadress.`
        : "Godkänd och synlig på Mina sidor.";
    }
    // Kontorsträffarna nämns för sig: det är dem bolagen betalar för, och
    // raden är det enda stället där det syns i stunden. Hela kvittot finns
    // kvar per mottagare i Loggboken.
    const kontor = data?.viaKontor ?? 0;
    const bolag = kontor ? `${mejlade} bolag, varav ${kontor} till ett betalt kontors egen adress` : `${mejlade} bolag`;
    return utan
      ? `Godkänd. Mejl gick till ${bolag}; ${utan} saknar registrerad profil eller kontaktadress och ser den bara på Mina sidor.`
      : `Godkänd. Mejl gick till ${bolag}.`;
  }

  async function decide(inquiryId, decision) {
    setDecidingId(inquiryId);
    setErrorId(null);

    const res = await fetch("/api/admin/moderera-forfragan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryId, decision }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      setKvitto(kvittotext(decision, data));
      setQueue((prev) => prev.filter((item) => item.inquiryId !== inquiryId));
      setGodkanda((prev) => prev.filter((item) => item.inquiryId !== inquiryId));
      setBekraftaDra(null);
    } else {
      setErrorId(inquiryId);
    }
    setDecidingId(null);
  }

  const kvittoRad = kvitto ? (
    <p style={{ fontSize: 13, color: "var(--color-body)", margin: "0 0 18px" }}>{kvitto}</p>
  ) : null;

  function kort(item, knappar) {
    return (
      <div className="auth-panel" key={item.inquiryId}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
              {item.requesterName} · {item.requesterCompany}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)", overflowWrap: "anywhere" }}>
              {item.requesterRole} · {item.requesterCity} ·{" "}
              <a href={`mailto:${item.requesterEmail}`}>{item.requesterEmail}</a> ·{" "}
              <a href={`https://${item.requesterWebsite.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                {item.requesterWebsite}
              </a>
              {item.requesterPhone && (
                <>
                  {" · "}
                  <a href={`tel:${item.requesterPhone}`}>{item.requesterPhone}</a>
                </>
              )}
            </p>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
            {formatDate(item.moderatedAt || item.createdAt)}
          </span>
        </div>

        {item.orsaker?.length > 0 && (
          <div className="granskning-orsaker">
            <p>Godkändes inte automatiskt:</p>
            <ul>
              {item.orsaker.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        {(item.upphandling || item.searchRole || item.focusArea || item.service) && (
          <div className="tag-row" style={{ marginTop: 10 }}>
            {item.upphandling && <span className="tag">Upphandling</span>}
            {item.searchRole && <span className="tag">{item.searchRole}</span>}
            {item.focusArea && <span className="tag">{item.focusArea}</span>}
            {item.service && <span className="tag">{item.service}</span>}
          </div>
        )}

        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5 }}>{item.description}</p>

        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--color-muted)" }}>
          {knappar === "godkand" ? "Skickad till" : "Skickas till"}: <b>{item.companies.join(", ") || "—"}</b>
          {knappar === "godkand" && ` · ${item.automatiskt ? "godkänd automatiskt" : "godkänd av Recruitable"}`}
        </p>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {knappar === "godkand" ? (
            bekraftaDra === item.inquiryId ? (
              <>
                <span style={{ fontSize: 13 }}>Förfrågan försvinner från bolagens Mina sidor.</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={decidingId === item.inquiryId}
                  onClick={() => decide(item.inquiryId, "withdrawn")}
                >
                  {decidingId === item.inquiryId ? "..." : "Dra tillbaka"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setBekraftaDra(null)}>
                  Avbryt
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setBekraftaDra(item.inquiryId)}>
                Dra tillbaka
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={decidingId === item.inquiryId}
                onClick={() => decide(item.inquiryId, "approved")}
              >
                {decidingId === item.inquiryId ? "..." : "Godkänn"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={decidingId === item.inquiryId}
                onClick={() => decide(item.inquiryId, "rejected")}
              >
                Neka
              </button>
            </>
          )}
          {errorId === item.inquiryId && (
            <span style={{ color: "#c0392b", fontSize: 12.5 }}>Något gick fel, försök igen.</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {kvittoRad}
      {queue.length === 0 ? (
        <p style={{ color: "var(--color-muted)", margin: 0 }}>Inget att granska just nu.</p>
      ) : (
        queue.map((item) => kort(item, "ko"))
      )}

      {godkanda.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, margin: "28px 0 0" }}>Skickade de senaste 14 dagarna</h2>
          <p style={{ color: "var(--color-muted)", fontSize: 13.5, margin: 0 }}>
            Har något slunkit igenom som inte borde, kan du dra tillbaka det här.
          </p>
          {godkanda.map((item) => kort(item, "godkand"))}
        </>
      )}
    </div>
  );
}
