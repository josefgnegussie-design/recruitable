"use client";

import { CompanySurveys, CompanyTags } from "@/components/CompanyFacts";
import CompanyCities from "@/components/CompanyCities";
import { bolagsUrl } from "@/lib/slug";
import Bildspel from "@/components/Bildspel";

export default function SelectableCompanyCard({ company: c, selected, onToggle }) {
  return (
    <div className={`card selectable${selected ? "" : " excluded"}`} onClick={() => onToggle(c.id)}>
      <div className="card-top">
        <div className="card-ident">
          {c.logo && <img className="card-logo" src={c.logo} alt="" />}
          <div>
            <p className="card-name">{c.name}</p>
            <div className="card-city">
              {c.city.toUpperCase()} · GRUNDAT {c.founded}
            </div>
          </div>
        </div>
        <div className="card-top-right">
          <label className="card-select" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(c.id)} />
          </label>
          <div className={`stamp ${c.ka ? "" : "no"}`}>
            <span>{c.ka ? <>KOLLEKTIV-<br />AVTAL</> : <>EJ KA<br />&nbsp;</>}</span>
          </div>
        </div>
      </div>
      <CompanyTags services={c.services} focus={c.focus} />
      <CompanyCities cities={c.officeCities} city={c.city} />
      {c.slideshow?.length > 0 && (
        <div className="card-bildspel">
          <Bildspel bilder={c.slideshow} namn={c.name} />
        </div>
      )}
      {/* Visionen sattes förut ut ovillkorligt, så bolag utan vision fick ett
          tomt citattecken-par på kortet. */}
      {c.vision ? (
        <p className="card-vision">&ldquo;{c.vision}&rdquo;</p>
      ) : c.desc ? (
        <p className="card-vision plain">{c.desc}</p>
      ) : null}
      <CompanySurveys surveys={c.surveys} />
      {/* Kortet i sig väljer bolaget. Länken till hela profilen måste därför
          stoppa klicket, annars kryssar man ur bolaget på väg för att läsa om det. */}
      <div className="card-actions">
        <a
          className="btn btn-ghost"
          href={bolagsUrl(c)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Läs hela profilen
        </a>
      </div>
    </div>
  );
}
