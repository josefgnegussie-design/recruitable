"use client";

import AdressUppslag from "@/components/admin/AdressUppslag";

export const MAX_ADRESSER = 25;

function tomAdress() {
  return { street: "", postal_code: "", city: "" };
}

// Adresserna bolaget finns på. Postorten är den enda obligatoriska uppgiften —
// den är det besökaren ser i sökresultatet, och ett bolag ska kunna säga "vi
// finns i Malmö" utan att lämna ut gatuadressen till ett kontorshotell.
export default function AdressField({ value = [], onChange }) {
  const adresser = value.length ? value : [];

  // Tar emot en delmängd av fälten, eftersom ett valt postnummer fyller i
  // både postnummer och postort i samma ändring. Två separata anrop hade gett
  // två renderingar där den andra räknade på den första omgångens värden.
  function uppdatera(index, andring) {
    onChange(adresser.map((a, i) => (i === index ? { ...a, ...andring } : a)));
  }

  function laggTill() {
    onChange([...adresser, tomAdress()]);
  }

  function taBort(index) {
    onChange(adresser.filter((_, i) => i !== index));
  }

  return (
    <div className="field">
      {adresser.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: "0 0 12px" }}>
          Inga adresser tillagda än. Har ni kontor på flera orter syns alla i sökresultatet.
        </p>
      )}

      <div className="adress-lista">
        {adresser.map((a, i) => (
          <div className="adress-rad" key={i}>
            <div className="adress-falt">
              <div className="field">
                <label htmlFor={`adr-gata-${i}`}>Gatuadress och nummer</label>
                <input
                  id={`adr-gata-${i}`}
                  type="text"
                  value={a.street || ""}
                  onChange={(e) => uppdatera(i, { street: e.target.value })}
                  placeholder="Första Långgatan 12"
                />
              </div>
              <div className="field adress-postnr">
                <label htmlFor={`adr-postnr-${i}`}>Postnummer</label>
                <AdressUppslag
                  id={`adr-postnr-${i}`}
                  typ="postnummer"
                  value={a.postal_code || ""}
                  onChange={(v) => uppdatera(i, { postal_code: v })}
                  onValj={(t) => uppdatera(i, { postal_code: t.postnummer, city: t.postort })}
                  placeholder="413 27"
                />
              </div>
              <div className="field">
                <label htmlFor={`adr-ort-${i}`}>Postort</label>
                <AdressUppslag
                  id={`adr-ort-${i}`}
                  typ="postort"
                  value={a.city || ""}
                  onChange={(v) => uppdatera(i, { city: v })}
                  onValj={(t) => uppdatera(i, { city: t.postort })}
                  placeholder="Göteborg"
                />
              </div>
            </div>
            <button
              type="button"
              className="adress-ta-bort"
              onClick={() => taBort(i)}
              aria-label={`Ta bort adressen${a.city ? ` i ${a.city}` : ""}`}
            >
              Ta bort
            </button>
          </div>
        ))}
      </div>

      {adresser.length < MAX_ADRESSER && (
        <button type="button" className="btn btn-ghost" onClick={laggTill} style={{ flex: "none" }}>
          + Lägg till adress
        </button>
      )}

      <p className="hint">
        Postorten är obligatorisk och är den som visas för den som söker leverantör. Gatuadress och
        postnummer är frivilliga.
      </p>
    </div>
  );
}
