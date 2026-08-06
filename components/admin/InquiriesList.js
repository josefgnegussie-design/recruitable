"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABEL = { accepted: "Accepterad", declined: "Nekad" };

export default function InquiriesList({ inquiries: initialInquiries, initialHasMore }) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [updatingId, setUpdatingId] = useState(null);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

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
    const supabase = createClient();
    const { error } = await supabase
      .from("inquiry_recipients")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", recipientId);

    if (error) {
      console.error("Kunde inte uppdatera status:", JSON.stringify(error));
      setUpdatingId(null);
      return;
    }

    let extra = {};
    if (status === "accepted") {
      const res = await fetch("/api/mina-sidor/forfragan-detaljer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) extra = await res.json();
    }

    setInquiries((prev) =>
      prev.map((inq) => (inq.recipientId === recipientId ? { ...inq, status, ...extra } : inq))
    );
    setUpdatingId(null);
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
      {inquiries.map((inq) => {
        const unlocked = inq.status === "accepted" && inq.requester_name;
        return (
          <div className="auth-panel" key={inq.recipientId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{inq.requester_company}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-muted)" }}>
                  {unlocked ? `${inq.requester_name} · ${inq.requester_role} · ` : ""}
                  {inq.requester_city}
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
                <a
                  className="btn btn-primary"
                  href={`mailto:${inq.requester_email}`}
                  style={{ display: "inline-block" }}
                >
                  Svara {inq.requester_name.split(" ")[0]}
                </a>
              ) : (
                <span className="note" style={{ fontSize: 12.5 }}>
                  Kontaktuppgifter visas här så snart ni accepterat förfrågan.
                </span>
              )}
              <button
                type="button"
                className={`status-btn accept${inq.status === "accepted" ? " active" : ""}`}
                disabled={updatingId === inq.recipientId}
                onClick={() => setStatus(inq.recipientId, "accepted")}
              >
                Acceptera
              </button>
              <button
                type="button"
                className={`status-btn decline${inq.status === "declined" ? " active" : ""}`}
                disabled={updatingId === inq.recipientId}
                onClick={() => setStatus(inq.recipientId, "declined")}
              >
                Neka
              </button>
              {inq.status !== "pending" && (
                <span className={`status-pill ${inq.status}`}>{STATUS_LABEL[inq.status]}</span>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
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
