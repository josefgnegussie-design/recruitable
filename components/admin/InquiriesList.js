"use client";

import { useState } from "react";
import { MAX_ORD_I_SVAR, raknaOrd } from "@/lib/inquiries";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABEL = { accepted: "Accepterad", declined: "Nekad" };

function inomDennaManad(iso) {
  const d = new Date(iso);
  const nu = new Date();
  return d.getFullYear() === nu.getFullYear() && d.getMonth() === nu.getMonth();
}

const MANAD = new Date().toLocaleDateString("sv-SE", { month: "long" });

export default function InquiriesList({ inquiries: initialInquiries, initialHasMore }) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [updatingId, setUpdatingId] = useState(null);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bolagets egna ord till kunden, per förfrågan. Skickas med beslutet.
  const [meddelanden, setMeddelanden] = useState({});
  const [fel, setFel] = useState({});
  // Historiken växer month för månad och blir snabbt en vägg av kort där det
  // som kräver ett svar i dag ligger längst upp och allt annat bara skymmer.
  // Utgångsläget är därför innevarande månad, och resten hämtas på begäran.
  const [visaAllt, setVisaAllt] = useState(false);

  async function loadMore() {
    const last = inquiries[inquiries.length - 1];
    if (!last) return;

    setLoadingMore(true);
    const res = await fetch("/api/mina-sidor/forfragan-lista", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ before: last.receivedAt }),
    });

    if (res.ok) {
      const { inquiries: more, hasMore: nextHasMore } = await res.json();
      setInquiries((prev) => [...prev, ...more]);
      setHasMore(nextHasMore);
    }
    setLoadingMore(false);
  }

  async function setStatus(recipientId, status) {
    setUpdatingId(recipientId);

    const meddelande = (meddelanden[recipientId] || "").trim();

    const res = await fetch("/api/mina-sidor/forfragan-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, status, meddelande: meddelande || null }),
    });

    if (!res.ok) {
      const svar = await res.json().catch(() => ({}));
      setFel((f) => ({ ...f, [recipientId]: svar.error || "Kunde inte spara beslutet." }));
      setUpdatingId(null);
      return;
    }

    setFel((f) => ({ ...f, [recipientId]: null }));

    let extra = {};
    if (status === "accepted") {
      const detailsRes = await fetch("/api/mina-sidor/forfragan-detaljer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (detailsRes.ok) extra = await detailsRes.json();
    }

    setInquiries((prev) =>
      prev.map((inq) => (inq.recipientId === recipientId ? { ...inq, status, ...extra } : inq))
    );
    setUpdatingId(null);
  }

  // En obesvarad förfrågan visas alltid, hur gammal den än är. Månadsfiltret
  // finns för att städa undan det avklarade — döljer det något som väntar på
  // ett svar har det gjort tvärtom mot sitt syfte.
  const synliga = visaAllt
    ? inquiries
    : inquiries.filter((inq) => inomDennaManad(inq.receivedAt) || inq.status === "pending");
  const doldaLaddade = inquiries.length - synliga.length;
  // Räknas separat från synliga: de obesvarade från tidigare månader lyfts in i
  // vyn men hör inte till månadens antal, och en etikett som säger "den här
  // månaden" får inte räkna med dem.
  const iManaden = synliga.filter((inq) => inomDennaManad(inq.receivedAt)).length;
  const aldreObesvarade = synliga.length - iManaden;
  const finnsTidigare = doldaLaddade > 0 || hasMore;

  async function visaTidigare() {
    setVisaAllt(true);
    // Ligger allt som laddats inom månaden finns det inget dolt att fälla ut —
    // då måste nästa sida hämtas för att knappen ska betyda något.
    if (doldaLaddade === 0 && hasMore) await loadMore();
  }

  if (inquiries.length === 0) {
    return (
      <p style={{ marginTop: 24, color: "var(--color-muted)" }}>
        Inga förfrågningar än. När någon hittar er via Rekrytera-sidan och skickar en förfrågan dyker den upp
        här.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 13, color: "var(--color-muted)" }}>
          {visaAllt
            ? `Hela historiken · ${synliga.length} st`
            : `Den här månaden (${MANAD}) · ${iManaden} st`}
          {!visaAllt && aldreObesvarade > 0 &&
            ` · plus ${aldreObesvarade} obesvarad${aldreObesvarade === 1 ? "" : "e"} från tidigare`}
        </span>
        {visaAllt && (
          <button type="button" className="link-btn" onClick={() => setVisaAllt(false)}>
            Visa bara den här månaden
          </button>
        )}
      </div>

      {synliga.length === 0 && (
        <p style={{ margin: 0, color: "var(--color-muted)", fontSize: 14 }}>
          Inga förfrågningar i {MANAD}. Allt äldre finns kvar under knappen nedan.
        </p>
      )}

      {synliga.map((inq) => {
        const unlocked = inq.status === "accepted" && inq.requester_name;
        return (
          <div className="auth-panel" key={inq.recipientId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              {/* Rubriken var kundens bolagsnamn, vilket gav bort hela leaden
                  innan den betalats. Nu är rubriken behovet: vad de söker och
                  var uppdraget ligger. Bolagsnamnet blir rubrik igen när
                  förfrågan accepterats. */}
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
                  {unlocked
                    ? inq.requester_company
                    : [inq.search_role || inq.focus_area || "Förfrågan", inq.city || inq.region]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                  {unlocked
                    ? [inq.requester_name, inq.requester_role, inq.requester_phone, inq.requester_city]
                        .filter(Boolean)
                        .join(" · ")
                    : [inq.requester_first_name, inq.requester_role].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span style={{ fontSize: 12, color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                {formatDate(inq.receivedAt)}
              </span>
            </div>

            {(inq.focus_area || inq.service || inq.search_role) && (
              <div className="tag-row" style={{ marginTop: 10 }}>
                {inq.search_role && <span className="tag">{inq.search_role}</span>}
                {inq.focus_area && <span className="tag">{inq.focus_area}</span>}
                {inq.service && <span className="tag">{inq.service}</span>}
              </div>
            )}

            <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14.5, lineHeight: 1.5 }}>{inq.description}</p>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {unlocked ? (
                <>
                  <a
                    className="btn btn-primary"
                    href={`mailto:${inq.requester_email}`}
                    style={{ display: "inline-block" }}
                  >
                    {`Svara ${inq.requester_name.split(" ")[0]}`}
                  </a>
                  {inq.requester_phone && (
                    <a className="btn btn-ghost" href={`tel:${inq.requester_phone}`} style={{ display: "inline-block" }}>
                      {`Ring ${inq.requester_phone}`}
                    </a>
                  )}
                </>
              ) : (
                <span className="note" style={{ fontSize: 12.5 }}>
                  Kontaktuppgifter visas här så snart ni accepterat förfrågan.
                </span>
              )}
              <button
                type="button"
                className={`status-btn accept${inq.status === "accepted" ? " active" : ""}`}
                disabled={updatingId === inq.recipientId || raknaOrd(meddelanden[inq.recipientId]) > MAX_ORD_I_SVAR}
                onClick={() => setStatus(inq.recipientId, "accepted")}
              >
                Acceptera
              </button>
              <button
                type="button"
                className={`status-btn decline${inq.status === "declined" ? " active" : ""}`}
                disabled={updatingId === inq.recipientId || raknaOrd(meddelanden[inq.recipientId]) > MAX_ORD_I_SVAR}
                onClick={() => setStatus(inq.recipientId, "declined")}
              >
                Neka
              </button>
              {inq.status !== "pending" && (
                <span className={`status-pill ${inq.status}`}>{STATUS_LABEL[inq.status]}</span>
              )}
            </div>

            {/* Kunden får ett besked per mejl när ni svarar. En rad från er gör
                skillnad — särskilt vid ett nej, där skälet är värt mer för kunden
                än beskedet självt. Taket är ord och inte tecken, för det är ord
                man räknar när man skriver. */}
            {inq.status === "pending" && (
              <div className="svarsmeddelande">
                <label htmlFor={`meddelande-${inq.recipientId}`}>
                  Meddelande till kunden (frivilligt)
                </label>
                <textarea
                  id={`meddelande-${inq.recipientId}`}
                  rows={2}
                  maxLength={400}
                  value={meddelanden[inq.recipientId] || ""}
                  placeholder="Skickas med i beskedet — t.ex. varför ni tackar nej, eller när ni hör av er."
                  onChange={(e) =>
                    setMeddelanden((m) => ({ ...m, [inq.recipientId]: e.target.value }))
                  }
                />
                <span className={`ordrakning${raknaOrd(meddelanden[inq.recipientId]) > MAX_ORD_I_SVAR ? " over" : ""}`}>
                  {raknaOrd(meddelanden[inq.recipientId])} / {MAX_ORD_I_SVAR} ord
                </span>
              </div>
            )}

            {fel[inq.recipientId] && (
              <p style={{ color: "var(--color-error)", fontSize: 13, margin: "8px 0 0" }}>
                {fel[inq.recipientId]}
              </p>
            )}
          </div>
        );
      })}

      {!visaAllt && finnsTidigare && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loadingMore}
          onClick={visaTidigare}
          style={{ alignSelf: "center" }}
        >
          {loadingMore ? "Laddar..." : "Visa tidigare förfrågningar"}
        </button>
      )}

      {visaAllt && hasMore && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={loadingMore}
          onClick={loadMore}
          style={{ alignSelf: "center" }}
        >
          {loadingMore ? "Laddar..." : "Visa fler"}
        </button>
      )}
    </div>
  );
}
