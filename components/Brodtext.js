// Fritext från bolaget, presenterad som bolaget skrev den.
//
// Texten låg tidigare i en enda <p>, och HTML slår ihop all luft: det bolaget
// skrivit som fem stycken i formuläret kom ut som en enda vägg av text. Tomrad
// blir nytt stycke här, och enkla radbrytningar inom ett stycke behålls av
// white-space: pre-line i stilmallen.
//
// Ingen HTML tolkas — texten renderas som text. Ett bolag som klistrar in
// <script> i sin beskrivning får se taggen på skärmen, inte köra den.
export default function Brodtext({ text }) {
  const stycken = String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!stycken.length) return null;

  return stycken.map((stycke, i) => (
    <p className="brodtext" key={`${i}-${stycke.slice(0, 24)}`}>
      {stycke}
    </p>
  ));
}
