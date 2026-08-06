import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { clientIp } from "@/lib/requestIp";

// Kräver UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN i miljövariablerna
// (Vercel-integrationen mot Upstash sätter dessa automatiskt). Saknas de
// (t.ex. lokal utveckling utan Upstash uppsatt) stängs rate limiting av
// istället för att krascha routen.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const limiters = new Map();

function getLimiter(name, limit, windowSeconds) {
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
  const { success } = await limiter.limit(ip);

  if (!success) {
    const { NextResponse } = await import("next/server");
    return NextResponse.json(
      { error: "För många förfrågningar. Försök igen om en stund." },
      { status: 429 }
    );
  }

  return null;
}
