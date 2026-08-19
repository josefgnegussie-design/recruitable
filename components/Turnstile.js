"use client";

import { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Hur länge utmaningen får hålla på innan den räknas som misslyckad. Turnstile
// brukar vara klar på någon sekund; marginalen är till för sega uppkopplingar.
const FAILURE_TIMEOUT_MS = 12000;

let scriptPromise = null;
function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Osynlig/lättviktig bot-utmaning på formulär som kan missbrukas för spam.
// Renderas inte alls om NEXT_PUBLIC_TURNSTILE_SITE_KEY saknas.
//
// onError talar om för formuläret att utmaningen inte gick att genomföra, så att
// besökaren får veta varför skicka-knappen är låst. Utan det blir ett fel här —
// t.ex. en domän som inte är godkänd för nyckeln i Cloudflare — en död knapp
// utan förklaring, och användaren har ingen chans att förstå vad som hänt.
export default function Turnstile({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    // Utmaningen kan fallera på fler sätt än att anropa error-callback: render()
    // kastar t.ex. rakt av för en felformad nyckel, och skriptet kan utebli helt.
    // Tidsgränsen fångar alla varianter — utan den räcker det med ett oväntat fel
    // för att besökaren ska bli sittande framför en låst knapp utan besked.
    const failureTimer = setTimeout(() => {
      if (!cancelled) onError?.(true);
    }, FAILURE_TIMEOUT_MS);

    loadTurnstileScript().then((turnstile) => {
      if (cancelled || !turnstile || !containerRef.current) return;
      try {
        widgetId.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => {
            clearTimeout(failureTimer);
            onVerify(token);
            onError?.(false);
          },
          "expired-callback": () => onVerify(""),
          "error-callback": () => {
            clearTimeout(failureTimer);
            onVerify("");
            onError?.(true);
          },
        });
      } catch {
        clearTimeout(failureTimer);
        onError?.(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(failureTimer);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [onVerify, onError]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} style={{ margin: "14px 0" }} />;
}
