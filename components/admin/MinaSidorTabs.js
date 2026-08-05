"use client";

import { useState } from "react";
import ProfileEditor from "@/components/admin/ProfileEditor";
import InquiriesList from "@/components/admin/InquiriesList";

export default function MinaSidorTabs({ company, inquiries }) {
  const [tab, setTab] = useState("forfragningar");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
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

      {tab === "forfragningar" && <InquiriesList inquiries={inquiries} />}

      {tab === "profil" &&
        (company?.is_premium ? (
          <ProfileEditor company={company} />
        ) : (
          <p style={{ marginTop: 24 }}>
            Den utökade profilen kräver en aktiv premium-prenumeration. Kontakta info@recruitable.se för att
            komma igång.
          </p>
        ))}
    </div>
  );
}
