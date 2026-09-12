"use client";

import { useState } from "react";

export const ORTER_PA_KORT = 3;

// Orterna ett bolag finns på, som de visas för den som ska välja bolag att
// skicka en förfrågan till. Egen fil och inte i CompanyFacts, eftersom "se fler"
// kräver state — CompanyFacts importeras av serverkomponenter och måste förbli
// serverkod.
//
// Faller tillbaka på bolagets huvudort när office_cities är tom. Utan det vore
// raden tom för nästan hela registret: bara två bolag av 3 770 har fler orter
// ifyllda i dag.
export default function CompanyCities({ cities = [], city, max = ORTER_PA_KORT }) {
  const [visaAlla, setVisaAlla] = useState(false);

  const orter = cities.length ? cities : city ? [city] : [];
  if (!orter.length) return null;

  const dolda = orter.length - max;
  const visade = visaAlla || dolda <= 0 ? orter : orter.slice(0, max);

  // Kortet i förfrågningsflödet väljer bolaget när man klickar på det. Utan
  // stopPropagation kryssar man ur bolaget i samma klick som man ber om att få
  // se resten av orterna.
  function vaxla(e) {
    e.stopPropagation();
    e.preventDefault();
    setVisaAlla((v) => !v);
  }

  return (
    <p className="card-orter">
      <b>Finns i</b>
      {visade.join(" · ")}
      {dolda > 0 && (
        <>
          {" "}
          <button type="button" className="card-orter-fler" onClick={vaxla}>
            {visaAlla ? "visa färre" : "se fler"}
          </button>
        </>
      )}
    </p>
  );
}
