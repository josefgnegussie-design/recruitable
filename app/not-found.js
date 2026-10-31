import Link from "next/link";

export const metadata = {
  title: "Sidan finns inte",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
      <div>
        <div className="eyebrow">404</div>
        <h1 className="hero-title">Sidan finns inte</h1>
        <p className="hero-sub">Adressen kan ha ändrats eller vara felstavad. Sök bland bolagen i registret i stället.</p>
        <Link className="btn btn-primary" href="/rekrytera">Hitta bolag</Link>
      </div>
    </section>
  );
}
