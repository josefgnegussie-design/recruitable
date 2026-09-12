import Link from "next/link";
import { CompanySurveys, CompanyTags } from "@/components/CompanyFacts";
import CompanyCities from "@/components/CompanyCities";
import Bildspel from "@/components/Bildspel";

export default function CompanyCard({ company: c }) {
  return (
    <div className="card">
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
        <div className={`stamp ${c.ka ? "" : "no"}`}>
          <span>{c.ka ? <>KOLLEKTIV-<br />AVTAL</> : <>EJ KA<br />&nbsp;</>}</span>
        </div>
      </div>
      <CompanyTags services={c.services} focus={c.focus} />
      <CompanyCities cities={c.officeCities} city={c.city} />
      {c.slideshow?.length > 0 && (
        <div className="card-bildspel">
          <Bildspel bilder={c.slideshow} namn={c.name} />
        </div>
      )}
      {/* Visionen står inom citattecken som bolagets egna ord, så den visas bara
          när den finns. Saknas den duger beskrivningen — den är vår text om
          bolaget, inte ett påstått citat. */}
      {c.vision ? (
        <p className="card-vision">&ldquo;{c.vision}&rdquo;</p>
      ) : c.desc ? (
        <p className="card-vision plain">{c.desc}</p>
      ) : null}
      <CompanySurveys surveys={c.surveys} />
      <div className="card-meta">
        <div><b>{c.revenue}</b>Omsättning {c.revenueYear}</div>
        <div><b>{c.employees}</b>Medarbetare {c.employeesYear}</div>
      </div>
      <div className="card-actions">
        <Link className="btn btn-primary" href={`/bolag/${c.id}`}>Se profil</Link>
        {c.link && (
          <a className="btn btn-ghost" href={c.link} target="_blank" rel="noopener noreferrer">Till webbplats</a>
        )}
      </div>
    </div>
  );
}
