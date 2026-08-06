const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Kräver TURNSTILE_SECRET_KEY i miljövariablerna. Saknas den (t.ex. lokal
// utveckling utan Turnstile uppsatt) släpps requesten igenom istället för
// att blockera allt.
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip || "" }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
