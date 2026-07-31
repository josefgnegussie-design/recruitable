"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { rolesForArea } from "@/lib/helpers";

export default function QuickStartPanel() {
  const router = useRouter();
  const [omrade, setOmrade] = useState("");
  const [yrke, setYrke] = useState("");
  const roles = useMemo(() => rolesForArea(omrade), [omrade]);

  function handleOmradeChange(e) {
    setOmrade(e.target.value);
    setYrke("");
  }

  function handleSubmit() {
    const params = new URLSearchParams();
    if (omrade) params.set("omrade", omrade);
    if (yrke) params.set("yrke", yrke);
    params.set("step", "2");
    router.push(`/matcha?${params.toString()}`);
  }

  return (
    <div className="qs-panel">
      <div className="qs-label">Rekrytera till&hellip;</div>
      <p className="qs-sub">Välj yrkesområde och yrke — se matchande bolag direkt, utan att skrolla vidare.</p>
      <div className="qs-select-row">
        <select className="qs-select" aria-label="Yrkesområde" value={omrade} onChange={handleOmradeChange}>
          <option value="">Alla yrkesområden</option>
          {Object.keys(YRKESOMRADEN).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select className="qs-select" aria-label="Yrke" value={yrke} onChange={(e) => setYrke(e.target.value)}>
          <option value="">Alla yrken</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <button className="qs-btn" onClick={handleSubmit}>Hitta bolag &rarr;</button>
    </div>
  );
}
