import Link from "next/link";
import { datumText } from "@/lib/upphandling";

// Delas av den publika listan och fliken på Mina sidor.
export default function UpphandlingKort({ u, href, matchar = false }) {
  return (
    <article className="card upp-kort">
      <div className="card-top">
        <div>
          <h3 className="card-name">{u.title}</h3>
          <div className="upp-kopare">{u.kopare_namn || u.buyer_description}</div>
        </div>
        {u.buyer_type === "offentlig" && <span className="status-pill">Marknadsdialog</span>}
      </div>
      <div className="tag-row">
        <span className="tag">{u.service}</span>
        {u.competences.map((k) => (
          <span className="tag" key={k}>{k}</span>
        ))}
      </div>
      <dl className="upp-fakta">
        <dt>Orter</dt>
        <dd>{u.cities.join(", ")}</dd>
        {u.contract_period && (
          <>
            <dt>Avtalstid</dt>
            <dd>{u.contract_period}</dd>
          </>
        )}
        <dt>Sista dag</dt>
        <dd>{datumText(u.interest_deadline)}</dd>
      </dl>
      {matchar && <p className="upp-matchar">Matchar yrkesområden i er profil</p>}
      <Link className="card-lank" href={href}>Visa upphandlingen</Link>
    </article>
  );
}
