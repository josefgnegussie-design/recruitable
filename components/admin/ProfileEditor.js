"use client";

import { useState } from "react";
import ImageUploadField from "@/components/admin/ImageUploadField";

function emptyMember() {
  return { id: crypto.randomUUID(), name: "", role: "", photo_url: "" };
}

export default function ProfileEditor({ company }) {
  const [extendedVision, setExtendedVision] = useState(company.extended_vision || "");
  const [coverImage, setCoverImage] = useState(company.cover_image || "");
  const [logo, setLogo] = useState(company.logo || "");
  const [members, setMembers] = useState(
    company.team_members?.length
      ? company.team_members.map((m) => ({ id: crypto.randomUUID(), ...m }))
      : []
  );
  const [customerScore, setCustomerScore] = useState(company.surveys?.customer_satisfaction?.score ?? "");
  const [customerSource, setCustomerSource] = useState(company.surveys?.customer_satisfaction?.source ?? "");
  const [employeeScore, setEmployeeScore] = useState(company.surveys?.employee_satisfaction?.score ?? "");
  const [employeeSource, setEmployeeSource] = useState(company.surveys?.employee_satisfaction?.source ?? "");
  const [status, setStatus] = useState("idle");

  function addMember() {
    setMembers((prev) => [...prev, emptyMember()]);
  }

  function updateMember(id, field, value) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSave(e) {
    e.preventDefault();
    setStatus("saving");

    const payload = {
      companyId: company.id,
      extendedVision,
      coverImage,
      logo,
      teamMembers: members
        .filter((m) => m.name.trim())
        .map((m) => ({ name: m.name, role: m.role, photo_url: m.photo_url })),
      surveys: {
        customer_satisfaction:
          customerScore !== "" ? { score: Number(customerScore), source: customerSource } : null,
        employee_satisfaction:
          employeeScore !== "" ? { score: Number(employeeScore), source: employeeSource } : null,
      },
    };

    const res = await fetch("/api/profil/spara", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  return (
    <div style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px 60px" }}>
      <h1 className="hero-title" style={{ fontSize: 28 }}>
        Redigera profil — {company.name}
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13.5, marginTop: 6 }}>
        Det här är er egna presentation, tydligt avskild från de objektiva uppgifterna på er profil. Ändringar
        syns direkt för besökare på recruitable.se efter att ni sparat.
      </p>

      <form onSubmit={handleSave} style={{ marginTop: 28 }}>
        <div className="auth-panel">
          <div className="filter-title">Bild och logotyp</div>
          <ImageUploadField
            label="Omslagsbild"
            companyId={company.id}
            folder="cover"
            value={coverImage}
            onChange={setCoverImage}
          />
          <div style={{ height: 18 }} />
          <ImageUploadField
            label="Logotyp"
            companyId={company.id}
            folder="logo"
            value={logo}
            onChange={setLogo}
            shape="circle"
          />
        </div>

        <div className="auth-panel" style={{ marginTop: 20 }}>
          <div className="filter-title">Utökad vision/beskrivning</div>
          <div className="field">
            <textarea
              id="extended-vision"
              rows={6}
              value={extendedVision}
              onChange={(e) => setExtendedVision(e.target.value)}
              placeholder="Berätta mer om er verksamhet, kultur och vad som gör er unika."
            />
          </div>
        </div>

        <div className="auth-panel" style={{ marginTop: 20 }}>
          <div className="filter-title">Medarbetare</div>
          <div className="member-list">
            {members.map((m) => (
              <div className="member-row" key={m.id}>
                <ImageUploadField
                  label=""
                  companyId={company.id}
                  folder="team"
                  value={m.photo_url}
                  onChange={(url) => updateMember(m.id, "photo_url", url)}
                  shape="circle"
                />
                <input
                  type="text"
                  placeholder="Namn"
                  value={m.name}
                  onChange={(e) => updateMember(m.id, "name", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Roll"
                  value={m.role}
                  onChange={(e) => updateMember(m.id, "role", e.target.value)}
                />
                <button type="button" className="member-remove" onClick={() => removeMember(m.id)}>
                  Ta bort
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="add-member-btn" onClick={addMember}>
            + Lägg till medarbetare
          </button>
        </div>

        <div className="auth-panel" style={{ marginTop: 20 }}>
          <div className="filter-title">Undersökningar</div>
          <div className="survey-row">
            <div>
              <label htmlFor="customer-score">Kundnöjdhet (1–5)</label>
              <input
                id="customer-score"
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={customerScore}
                onChange={(e) => setCustomerScore(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="customer-source">Källa</label>
              <input
                id="customer-source"
                type="text"
                placeholder="T.ex. egen kundundersökning, hösten 2026"
                value={customerSource}
                onChange={(e) => setCustomerSource(e.target.value)}
              />
            </div>
          </div>
          <div className="survey-row">
            <div>
              <label htmlFor="employee-score">Medarbetarnöjdhet (1–5)</label>
              <input
                id="employee-score"
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={employeeScore}
                onChange={(e) => setEmployeeScore(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="employee-source">Källa</label>
              <input
                id="employee-source"
                type="text"
                placeholder="T.ex. medarbetarundersökning, våren 2026"
                value={employeeSource}
                onChange={(e) => setEmployeeSource(e.target.value)}
              />
            </div>
          </div>
        </div>

        <button className="qs-btn" type="submit" disabled={status === "saving"} style={{ marginTop: 20 }}>
          {status === "saving" ? "Sparar..." : "Spara"}
        </button>
        {status === "saved" && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>Sparat!</p>}
        {status === "error" && <p style={{ color: "#c0392b", fontSize: 13, marginTop: 8 }}>Något gick fel.</p>}
      </form>
    </div>
  );
}
