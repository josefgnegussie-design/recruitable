export default function Stepper({ step }) {
  const dots = [];
  for (let i = 1; i <= 6; i++) {
    const cls = i < step ? "done" : i === step ? "active" : "";
    dots.push(
      <div className={`flow-dot ${cls}`} key={`dot-${i}`}>
        {i < step ? "✓" : i}
      </div>
    );
    if (i < 6) {
      dots.push(<div className={`flow-line ${i < step ? "done" : ""}`} key={`line-${i}`}></div>);
    }
  }
  return <div className="flow-stepper">{dots}</div>;
}
