const CONSENT_KEY = "recruitable-cookie-consent";
const CONSENT_EVENT = "cookie-consent-changed";

export function getConsent() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CONSENT_KEY);
}

export function setConsent(value) {
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export const CONSENT_CHANGED_EVENT = CONSENT_EVENT;
