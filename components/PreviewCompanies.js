"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COMPANIES } from "@/lib/companies";

// Serverrenderar de tre första bolagen och byter till ett slumpat urval när
// sidan laddats — samma mönster som featured-listan på /rekrytera. Att slumpa
// först i useEffect håller server- och klientmarkup identisk vid hydrering.
export default function PreviewCompanies() {
  const [preview, setPreview] = useState(() => COMPANIES.slice(0, 3));

  useEffect(() => {
    const shuffled = [...COMPANIES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setPreview(shuffled.slice(0, 3));
  }, []);

  return (
    <div className="preview-grid">
      {preview.map((c) => (
        <Link className="preview-card" href={`/bolag/${c.id}`} key={c.id}>
          <div className="pc-top">
            <div>
              <p className="pc-name">{c.name}</p>
              <div className="pc-city">{c.city.toUpperCase()} · GRUNDAT {c.founded}</div>
            </div>
          </div>
          <p className="pc-vision">&ldquo;{c.vision}&rdquo;</p>
          <div className="pc-tags">
            {c.focus.map((f) => (
              <span className="tag" key={f}>{f}</span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  );
}
