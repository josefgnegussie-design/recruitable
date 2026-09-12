"use client";

import { useState } from "react";

// Ett faktavärde i Snabbfakta som kan vara hur långt som helst. Yrkesrollerna
// är värstingen: ett bolag som kryssat i trettio roller fyllde hela spalten med
// en kommalista, och Snabbfakta — som ska gå att överblicka på ett ögonkast —
// blev sidans längsta stycke.
//
// Fem värden visas, resten bakom en knapp. Antalet som döljs står i knappen och
// inte bara "visa fler": skillnaden mellan tre dolda roller och trettio avgör
// om det är värt att trycka.
const TAK = 5;

export default function Faktalista({ varden }) {
  const [alla, setAlla] = useState(false);

  if (!varden?.length) return null;

  const kvar = varden.length - TAK;
  const visade = alla || kvar <= 0 ? varden : varden.slice(0, TAK);

  // Mittpunkt och inte komma mellan värdena: flera yrkesområden heter saker som
  // "Installation, drift, underhåll", och med komma som skiljetecken gick det
  // inte att se var ett område slutade och nästa började — särskilt inte när
  // knappen bredvid påstår hur många de är.
  return (
    <span className="v">
      {visade.join(" · ")}
      {kvar > 0 && (
        <button type="button" className="fakta-mer" onClick={() => setAlla(!alla)}>
          {alla ? "visa färre" : `visa ${kvar} till`}
        </button>
      )}
    </span>
  );
}
