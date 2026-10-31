import { createHash, randomBytes } from "node:crypto";

// Inbjudningar av kollegor till ett bolagskonto. Se
// supabase/migration_inbjudningar.sql.

export const INBJUDAN_GILTIG_DAGAR = 7;

// 32 slumpade byte, base64url — långt över vad som går att gissa. Själva
// token går bara ut i mejlet; databasen har hashen.
export function nyInbjudningstoken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashaToken(token) };
}

export function hashaToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function rimligToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export { domanUrEpost, domanUrWebbadress } from "@/lib/overtagande";

// En öppen inbjudan, eller null om den är använd, återkallad eller för gammal.
// Det sista kontrolleras här och inte bara i databasen, så att en utgången
// inbjudan aldrig löses in för att någon glömt villkoret i en fråga.
export async function hamtaOppenInbjudan(admin, token) {
  if (!rimligToken(token)) return null;

  const { data } = await admin
    .from("bolagsinbjudningar")
    .select("id, company_id, epost, giltig_till, antagen_at, aterkallad_at, companies(name)")
    .eq("token_hash", hashaToken(token))
    .maybeSingle();

  if (!data || data.antagen_at || data.aterkallad_at) return null;
  if (new Date(data.giltig_till).getTime() < Date.now()) return null;
  return data;
}

// Öppna inbjudningar för ett bolag, för listan i kontofliken.
export async function hamtaInbjudningar(admin, companyId) {
  const { data } = await admin
    .from("bolagsinbjudningar")
    .select("id, epost, created_at, giltig_till")
    .eq("company_id", companyId)
    .is("antagen_at", null)
    .is("aterkallad_at", null)
    .gt("giltig_till", new Date().toISOString())
    .order("created_at", { ascending: true });

  return (data ?? []).map((r) => ({ id: r.id, epost: r.epost, skickad: r.created_at, giltigTill: r.giltig_till }));
}
