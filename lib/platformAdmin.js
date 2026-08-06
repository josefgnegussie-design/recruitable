// Recruitables egna interna granskare (inte att förväxla med ett bolags
// egen admin/company_admins). Styrs via en kommaseparerad lista i
// PLATFORM_ADMIN_EMAILS, så att listan kan ändras utan kodändring.
export function isPlatformAdmin(email) {
  if (!email) return false;
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
