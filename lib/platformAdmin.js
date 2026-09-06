// Recruitables egna interna granskare (inte att förväxla med ett bolags
// egen admin/company_admins). Styrs via en kommaseparerad lista i
// PLATFORM_ADMIN_EMAILS, så att listan kan ändras utan kodändring.
export function isPlatformAdmin(email) {
  if (!email) return false;
  const allowlist = platformAdminEmails();
  return allowlist.includes(email.toLowerCase());
}

// Samma lista, men till mejlutskick (t.ex. "ny förfrågan att granska").
export function platformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Vilka adresser som ska få notismejlen — ny förfrågan att granska, ny
// kontoansökan, ett bolag som svarat, problem med en premiumbetalning.
//
// Skild från listan ovan med flit. Den styr vem som får logga in och se
// granskningsköerna, och en brevlåda man bara vill få kopior till ska inte
// samtidigt få nycklarna till hela sajten. Saknas NOTIS_EMAILS går notiserna
// till administratörerna, precis som förut.
export function notisEmails() {
  const egen = (process.env.NOTIS_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return egen.length ? egen : platformAdminEmails();
}
