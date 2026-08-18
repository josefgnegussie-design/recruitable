import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { clientIp } from "@/lib/requestIp";

// Kräver UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN i miljövariablerna
// (Vercel-integrationen mot Upstash sätter dessa automatiskt). Saknas de
// (t.ex. lokal utveckling utan Upstash uppsatt) stängs rate limiting av
// istället för att krascha routen.
//
// Klienten skapas lat och bakom en URL-kontroll: ett satt men ogiltigt värde
// fick tidigare Redis att kasta redan vid modulladdning, vilket fällde varje
// route som importerar den här filen — inklusive under `next build`.
let redisClient;

function getRedis() {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !url.startsWith("https://")) {
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch (err) {
    console.error("Kunde inte skapa Redis-klienten för rate limiting:", err.message);
    redisClient = null;
  }
  return redisClient;
}

const limiters = new Map();

function getLimiter(name, limit, windowSeconds) {
  const redis = getRedis();
  if (!redis) return null;
  if (!limiters.has(name)) {
    limiters.set(
      name,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: `recruitable:${name}`,
      })
    );
  }
  return limiters.get(name);
}

// name: unik nyckel per route. limit/windowSeconds: t.ex. (5, 3600) = max 5/timme.
// Returnerar null om requesten får fortsätta, annars ett NextResponse-svar
// (429) som routen ska returnera direkt.
export async function rateLimit(request, name, limit, windowSeconds) {
  const limiter = getLimiter(name, limit, windowSeconds);
  if (!limiter) return null;

  const ip = clientIp(request);
  let success = true;
  try {
    ({ success } = await limiter.limit(ip));
  } catch (err) {
    // Om Upstash är nere eller kvoten är slut ska det inte slå ut hela
    // routen — släpp igenom istället för att krascha på ett Redis-fel.
    console.error(`Rate limit-kontroll (${name}) misslyckades, släpper igenom:`, err);
    return null;
  }

  if (!success) {
    const { NextResponse } = await import("next/server");
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en stund." },
      { status: 429 }
    );
  }

  return null;
}
