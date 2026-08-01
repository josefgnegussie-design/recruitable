"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { COMPANIES } from "@/lib/companies";
import { partnersRelevance } from "@/lib/helpers";
import CompanyCard from "@/components/CompanyCard";

function PartnersResultContent() {
  const searchParams = useSearchParams();
  const omrade = searchParams.get("omrade") || "";
  const ort = searchParams.get("ort") || "";

  const list = useMemo(
    () =>
      COMPANIES.map((c) => ({ c, score: partnersRelevance(c, omrade, ort) }))
        .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, "sv"))
        .map((x) => x.c),
    [omrade, ort]
  );

  return (
    <div id="view-partners-results">
      <Link className="back-link" href="/partners">&larr; Tillbaka till filtret</Link>

      <section className="hero">
        <div>
          <div className="eyebrow">Rangordnade efter relevans · Sverige</div>
          <h1 className="hero-title">Partners <em>för er</em></h1>
          <p className="hero-sub">
            Visar {list.length} partners för {omrade || "alla yrkesområden"} · {ort || "alla orter"}, mest relevanta först.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 24px 40px" }}>
        <div className="results-bar">
          <div className="results-count"><b>{list.length}</b> partners, mest relevanta först</div>
        </div>
        <div className="grid">
          {list.map((c) => (
            <CompanyCard company={c} key={c.id} />
          ))}
        </div>
      </div>

      <div className="disclaimer">
        <b>Om datan:</b> Omsättning, antal medarbetare, adress och etableringsår är hämtade från offentliga källor
        (Bolagsverket via Allabolag/Ratsit/Bolagsfakta/hitta.se) samt respektive bolags egna webbplatser, kontrollerade
        i juli 2026. Där bolagens årsredovisning för 2025 ännu inte var tillgänglig visas senaste rapporterade år
        (2024) istället — detta anges vid varje bolag. Vissa siffror avser koncernnivå snarare än den enskilda
        juridiska person som är verksam i Sverige. Uppgifterna bör verifieras direkt mot bolagen innan de
        används i skarpt beslutsunderlag.
      </div>
    </div>
  );
}

export default function PartnersResultPage() {
  return (
    <Suspense fallback={null}>
      <PartnersResultContent />
    </Suspense>
  );
}
