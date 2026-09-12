"use client";

import { useState } from "react";
import ProfilEditor from "@/components/admin/ProfilEditor";
import InquiriesList from "@/components/admin/InquiriesList";
import PremiumManageButton from "@/components/admin/PremiumManageButton";
import Kontoflik from "@/components/admin/Kontoflik";
import OfficesManager from "@/components/admin/OfficesManager";
import LoggaUtKnapp from "@/components/admin/LoggaUtKnapp";

export default function MinaSidorTabs({ company, inquiries, hasMore, premiumStatus, offices, officeStatus, arAgare, administratorer }) {
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
        <button
          type="button"
          className={`tab-btn${tab === "konto" ? " active" : ""}`}
          onClick={() => setTab("konto")}
        >
          Konto
        </button>
        <LoggaUtKnapp />
      </div>

      {tab === "forfragningar" && <InquiriesList inquiries={inquiries} initialHasMore={hasMore} />}

      {/* Hela profilen redigeras av alla verifierade bolag. Fälten är precis det
          en kund väljer leverantör utifrån, så en betalvägg här gör registret
          sämre för den sida som flödet börjar hos. Prenumerationen ska i stället
          knytas till förfrågningarna — knappen nedan finns kvar så länge, så att
          de som redan betalar kan se och avsluta sin prenumeration. */}
      {tab === "profil" && (
        <>
          <ProfilEditor company={company} />
          {/* Prenumerationen är ägarens ansvar — knappen leder till Stripes
              portal, där den som kommer in kan säga upp abonnemanget. */}
          {company?.is_premium && arAgare && <PremiumManageButton />}
        </>
      )}

      {tab === "kontor" && <OfficesManager offices={offices || []} />}

      {tab === "konto" && <Kontoflik administratorer={administratorer} duArAgare={arAgare} />}
    </div>
  );
}
