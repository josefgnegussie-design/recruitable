import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { arRobot, besokarHash, loggaHandelse, stadaSokvag } from "@/lib/statistik";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tar emot en sidvisning från webbläsaren. Skriver ingen cookie, sparar
// varken IP-adress eller user agent, och kräver därför inget samtycke —
// till skillnad från Google Analytics, som ligger bakom cookie-bannern och
// alltså bara mäter de besökare som tackat ja.
//
// Svaret är alltid 204, även när vi valt att inte spara raden. Det finns
// inget att berätta för webbläsaren, och ett felmeddelande hade bara blivit
// en karta över vad filtret släpper igenom.
export async function POST(request) {
  const limited = await rateLimit(request, "statistik-handelse", 240, 3600);
  if (limited) return limited;

  if (arRobot(request.headers.get("user-agent"))) {
    return new NextResponse(null, { status: 204 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = stadaSokvag(body?.path);
  if (!path) return new NextResponse(null, { status: 204 });

  await loggaHandelse({
    eventType: "sidvisning",
    path,
    visitorHash: besokarHash(request),
  });

  return new NextResponse(null, { status: 204 });
}
