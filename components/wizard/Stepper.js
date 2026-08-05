export default function Stepper({ step, total = 6 }) {
  const dots = [];
  for (let i = 1; i <= total; i++) {
    const cls = i < step ? "done" : i === step ? "active" : "";
    dots.push(
      <div className={`flow-dot ${cls}`} key={`dot-${i}`}>
        {i < step ? "✓" : i}
      </div>
    );
    if (i < total) {
      dots.push(<div className={`flow-line ${i < step ? "done" : ""}`} key={`line-${i}`}></div>);
    }
  }
  return <div className="flow-stepper">{dots}</div>;
}
