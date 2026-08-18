import { Redis } from "@upstash/redis";

// Senast kända premiumdata per bolag. Poängen är att en betalande kunds
// utökade profil ska överleva att Supabase är nere eller felkonfigurerat —
// utan kopia blir alternativet att visa grundprofilen som om bolaget aldrig
// betalat.
//
// Samma miljövariabler som rate limiting (se lib/rateLimit.js), men klienten
// skapas lat och bakom en URL-kontroll: ett satt men trasigt värde får inte
// kasta vid modulladdning, för då faller hela profilsidan — precis det den
// här filen finns för att förhindra.
let client;

function getRedis() {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !url.startsWith("https://")) {
    client = null;
    return client;
  }

  try {
    client = new Redis({ url, token });
  } catch (err) {
    console.error("Kunde inte skapa Redis-klienten för premiumcachen:", err.message);
    client = null;
  }
  return client;
}

// Rejält tilltagen — kopian ska finnas kvar även efter en längre störning.
// Den skrivs över vid varje lyckad hämtning, så den blir aldrig gammal i
// praktiken så länge sidan renderas.
const TTL_SECONDS = 60 * 60 * 24 * 30;

function key(companyId) {
  return `recruitable:premium:${companyId}`;
}

// Värdet lagras inbäddat i ett objekt eftersom null är ett giltigt svar
// (bolaget har ingen rad i companies) och måste gå att skilja från
// "ingen kopia finns".
export async function writeCachedPremium(companyId, payload) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key(companyId), { payload }, { ex: TTL_SECONDS });
  } catch (err) {
    console.error(`Kunde inte cacha premiumdata för bolag ${companyId}:`, err.message);
  }
}

export async function readCachedPremium(companyId) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const cached = await redis.get(key(companyId));
    return cached?.payload ?? null;
  } catch (err) {
    console.error(`Kunde inte läsa cachad premiumdata för bolag ${companyId}:`, err.message);
    return null;
  }
}
