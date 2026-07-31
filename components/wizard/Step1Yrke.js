import { useMemo } from "react";
import { YRKESOMRADEN } from "@/lib/taxonomy";
import { rolesForArea } from "@/lib/helpers";

export default function Step1Yrke({ flow, patch, onNext }) {
  const roles = useMemo(() => rolesForArea(flow.omrade), [flow.omrade]);

  function handleOmradeChange(e) {
    patch({ omrade: e.target.value, yrke: "" });
  }

  return (
    <div className="flow-panel">
      <div className="flow-eyebrow">Steg 1 av 6</div>
      <h3>Yrke</h3>
      <p className="sub">Välj yrkesområde och sedan yrke — precis som på Arbetsförmedlingens &ldquo;Hitta yrken&rdquo;.</p>
      <div className="field-row">
        <div className="field">
          <label htmlFor="fl-omrade">Yrkesområde</label>
          <select id="fl-omrade" value={flow.omrade} onChange={handleOmradeChange}>
            <option value="">Alla yrkesområden</option>
            {Object.keys(YRKESOMRADEN).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fl-yrke">Yrke</label>
          <select id="fl-yrke" value={flow.yrke} onChange={(e) => patch({ yrke: e.target.value })}>
            <option value="">Alla yrken</option>
            {roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flow-nav">
        <span></span>
        <button className="btn btn-primary" style={{ flex: "none", padding: "12px 24px" }} onClick={onNext}>Nästa &rarr;</button>
      </div>
    </div>
  );
}
