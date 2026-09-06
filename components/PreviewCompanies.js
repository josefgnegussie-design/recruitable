import Link from "next/link";

// Tre bolag som exempel på startsidan. Urvalet kommer färdigblandat från servern
// och innehåller bara bolag med en skriven profil — registret rymmer tusentals
// hämtade ur offentliga källor, och deras kort skulle bli tomma citattecken utan
// taggar. Komponenten behöver därför varken vara klientkod eller slumpa själv.
export default function PreviewCompanies({ bolag = [] }) {
  return (
    <div className="preview-grid">
      {bolag.map((c) => (
        <Link className="preview-card" href={`/bolag/${c.id}`} key={c.id}>
          <div className="pc-top">
            <div>
              <p className="pc-name">{c.name}</p>
              <div className="pc-city">{c.city.toUpperCase()} · GRUNDAT {c.founded}</div>
            </div>
          </div>
          {c.vision ? (
            <p className="pc-vision">&ldquo;{c.vision}&rdquo;</p>
          ) : (
            <p className="pc-vision plain">{c.desc}</p>
          )}
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
