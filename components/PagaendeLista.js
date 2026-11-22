import PagaendeRotation from "@/components/PagaendeRotation";

// Korten för pågående upphandlingar (/upphandling) och pågående förfrågningar
// (/rekrytera): ort, rubrik, en mening och stegen på en orange linje. Ett
// steg utan datum har inte hänt ännu och visas med en ofylld punkt. Tre kort
// syns åt gången; finns fler roterar de, se PagaendeRotation.
export default function PagaendeLista({ id, rubrik, intro, kort, stegEtikett }) {
  if (!kort.length) return null;
  return (
    <section className="upp-pagaende" aria-labelledby={id}>
      <h2 id={id} className="upp-rubrik-liten">{rubrik}</h2>
      <p className="upp-not" style={{ marginTop: 0 }}>{intro}</p>
      <PagaendeRotation kort={kort} stegEtikett={stegEtikett} />
    </section>
  );
}

// Inledningen under rubriken, beroende på om korten är riktiga, exempel eller
// en blandning.
export function pagaendeIntro(kort, { riktiga, exempel }) {
  const harRiktiga = kort.some((u) => !u.exempel);
  const harExempel = kort.some((u) => u.exempel);
  const text = harRiktiga ? riktiga : exempel;
  return harRiktiga && harExempel ? `${text} Kort märkta Exempel visar hur det kan se ut.` : text;
}
