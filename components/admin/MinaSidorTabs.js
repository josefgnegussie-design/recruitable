"use client";

import { useState } from "react";
import ProfileEditor from "@/components/admin/ProfileEditor";
import InquiriesList from "@/components/admin/InquiriesList";
import PremiumUpgrade from "@/components/admin/PremiumUpgrade";
import PremiumManageButton from "@/components/admin/PremiumManageButton";

export default function MinaSidorTabs({ company, inquiries, hasMore, premiumStatus }) {
  const [tab, setTab] = useState(premiumStatus ? "profil" : "forfragningar");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      {premiumStatus === "klart" && (
        <p style={{ background: "#eaf5ee", color: "#1c6b3a", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Tack! Betalningen är mottagen och premium aktiveras inom kort.
        </p>
      )}
      {premiumStatus === "avbrutet" && (
        <p style={{ background: "#fbeceb", color: "#c0392b", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Uppgraderingen avbröts — inget drogs från kortet.
        </p>
      )}
      <div className="tab-row">
        <button
          type="button"
          className={`tab-btn${tab === "forfragningar" ? " active" : ""}`}
          onClick={() => setTab("forfragningar")}
        >
          Förfrågningar{inquiries.length > 0 ? ` (${inquiries.length})` : ""}
        </button>
        <button
          type="button"
          className={`tab-btn${tab === "profil" ? " active" : ""}`}
          onClick={() => setTab("profil")}
        >
          Profil
        </button>
      </div>

      {tab === "forfragningar" && <InquiriesList inquiries={inquiries} initialHasMore={hasMore} />}

      {tab === "profil" &&
        (company?.is_premium ? (
          <>
            <PremiumManageButton />
            <ProfileEditor company={company} />
          </>
        ) : (
          <PremiumUpgrade />
        ))}
    </div>
  );
}
