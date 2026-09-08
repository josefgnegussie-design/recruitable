import { after, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaBolag, SIDSTORLEK } from "@/lib/companiesRepo";
import { arRobot, besokarHash, loggaHandelse } from "@/lib/statistik";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sökning i bolagsregistret, en sida i taget. Finns för att /rekrytera och
// matchningsflödet ska kunna söka utan att först ladda hem hela registret —
// det som i dag sker genom att den statiska listan importeras i klientkoden.
export async function GET(request) {
  const limited = await rateLimit(request, "bolag-sok", 120, 3600);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;

  const filter = {
    omrade: (params.get("omrade") || "").slice(0, 100),
    tjanst: (params.get("tjanst") || "").slice(0, 100),
    ort: (params.get("ort") || "").slice(0, 100),
  };

  const resultat = await hamtaBolag({
    ...filter,
    sida: params.get("sida") || 1,
    antal: params.get("antal") || SIDSTORLEK,
  });

  // Bara första sidan av en sökning med minst ett filter räknas. Utan de två
  // villkoren hade "bläddra vidare" och den tomma listningen sett ut som nya
  // sökningar, och statistiken hade svarat på fel fråga.
  const harFilter = Object.values(filter).some(Boolean);
  const forstaSidan = Number(params.get("sida") || 1) === 1;

  if (harFilter && forstaSidan && !arRobot(request.headers.get("user-agent"))) {
    // Hashen och filtren räknas fram här, medan requesten fortfarande finns,
    // men skrivningen läggs i after() och körs efter att svaret gått iväg.
    // Ett await här hade lagt en rundtur till databasen på varje sökning —
    // en fördröjning besökaren betalar för statistik ingen väntar på.
    const visitorHash = besokarHash(request);
    const metadata = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));

    after(() => loggaHandelse({ eventType: "sokning", path: "/rekrytera", visitorHash, metadata }));
  }

  return NextResponse.json(resultat);
}
