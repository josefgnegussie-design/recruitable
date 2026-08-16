"use client";

import { useState } from "react";
import ProfileEditor from "@/components/admin/ProfileEditor";
import InquiriesList from "@/components/admin/InquiriesList";
import PremiumUpgrade from "@/components/admin/PremiumUpgrade";
import PremiumManageButton from "@/components/admin/PremiumManageButton";
import OfficesManager from "@/components/admin/OfficesManager";

export default function MinaSidorTabs({ company, inquiries, hasMore, premiumStatus, offices, officeStatus }) {
  const [tab, setTab] = useState(premiumStatus ? "profil" : officeStatus ? "kontor" : "forfragningar");

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
      {officeStatus === "klart" && (
        <p style={{ background: "#eaf5ee", color: "#1c6b3a", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Tack! Betalningen är mottagen och kontoret aktiveras inom kort.
        </p>
      )}
      {officeStatus === "avbrutet" && (
        <p style={{ background: "#fbeceb", color: "#c0392b", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
          Tillägget av kontoret avbröts — inget drogs från kortet.
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
        <button
          type="button"
          className={`tab-btn${tab === "kontor" ? " active" : ""}`}
          onClick={() => setTab("kontor")}
        >
          Kontor{offices?.length > 0 ? ` (${offices.length})` : ""}
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

      {tab === "kontor" && <OfficesManager offices={offices || []} />}
    </div>
  );
}
