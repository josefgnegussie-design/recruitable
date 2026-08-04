export const metadata = {
  title: "Recruitable — Snart tillbaka",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-inner">
        <div className="mark"></div>
        <div className="kicker">Recruitable</div>
        <h1>Vi är strax <em>tillbaka</em>.</h1>
        <p>
          Vi finjusterar sajten just nu och är snart igång igen. Har du en fråga under tiden?
          Mejla oss på <a href="mailto:info@recruitable.se">info@recruitable.se</a>.
        </p>
        <div className="footer">© {new Date().getFullYear()} Recruitable</div>
      </div>
    </div>
  );
}
