import Link from "next/link";
import { logoColor, logoInitials } from "@/lib/helpers";

export default function LogoTile({ company: c }) {
  const multiSite = c.address.includes(";");
  return (
    <div className="logo-tile">
      {c.logo ? (
        <img className="logo-badge-img" src={c.logo} alt={`${c.name} logotyp`} />
      ) : (
        <div className="logo-badge" style={{ background: logoColor(c.name) }}>
          {logoInitials(c.name)}
        </div>
      )}
      <div className="logo-name">{c.name}</div>
      <div className={`logo-rating${c.rating ? "" : " none"}`}>
        {c.rating ? (
          <>
            <span className="star">★</span> {c.rating.toFixed(1)} <span>({c.ratingCount})</span>
          </>
        ) : (
          "Inga recensioner"
        )}
      </div>
      {multiSite && <div className="logo-multi">Flera orter</div>}
      <Link className="logo-link" href={`/bolag/${c.id}`}>
        Läs mer &rarr;
      </Link>
    </div>
  );
}
