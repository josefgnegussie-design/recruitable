"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "recruitable:utkast:";

// Sparar ett flerstegsformulärs tillstånd i webbläsaren så att besökaren alltid kan
// gå tillbaka ett steg och rätta det hen redan fyllt i — även efter en omladdning
// eller en tur ut till en annan sida och tillbaka igen.
//
// sessionStorage, inte localStorage: utkastet ska leva så länge fliken är öppen och
// försvinna när den stängs, så att inget ligger kvar på en delad dator.
//
// Värden som inte hör hemma i ett utkast (lösenord, "skickar just nu"-flaggor)
// filtreras bort med serialize-funktionen — det som aldrig sparas kan aldrig läcka.
// serialize/deserialize förutsätts vara definierade utanför komponenten, så att de
// har samma identitet mellan renderingar och inte startar om effekterna nedan.
export function useSessionDraft(key, initialState, { serialize, deserialize } = {}) {
  const storageKey = PREFIX + key;
  const [state, setState] = useState(initialState);
  // Innan utkastet är inläst får inget skrivas tillbaka — annars skulle den tomma
  // startrenderingen hinna skriva över det som redan låg sparat.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const restoredState = deserialize ? deserialize(parsed) : parsed;
        setState((prev) => ({ ...prev, ...restoredState }));
      }
    } catch {
      // Trasigt eller inkompatibelt utkast: börja om från de tomma fälten
      // istället för att fälla hela formuläret.
    }
    setRestored(true);
  }, [storageKey, deserialize]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(serialize ? serialize(state) : state));
    } catch {
      // Privat läge eller full kvot — formuläret ska fungera ändå, bara utan utkast.
    }
  }, [restored, state, storageKey, serialize]);

  const patch = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...(typeof partial === "function" ? partial(prev) : partial) }));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Se ovan.
    }
  }, [storageKey]);

  return { state, setState, patch, restored, clearDraft };
}
