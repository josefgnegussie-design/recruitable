"use client";

import { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
export default function Turnstile({ onVerify }) {
  const containerRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript().then((turnstile) => {
      if (cancelled || !turnstile || !containerRef.current) return;
      widgetId.current = turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: onVerify,
        "expired-callback": () => onVerify(""),
        "error-callback": () => onVerify(""),
      });
    });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
    };
  }, [onVerify]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} style={{ margin: "14px 0" }} />;
}
