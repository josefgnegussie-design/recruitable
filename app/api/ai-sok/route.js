import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { tolka, MAX_TECKEN } from "@/lib/aiSok";
import { hamtaBolag } from "@/lib/companiesRepo";

export const runtime = "nodejs";

const TOMT = { omrade: "", tjanst: "", ort: "" };

// Startsidans AI-sökfält. Varje anrop kostar ett modellanrop, så taket är
// dubbelt: få anrop per minut stoppar skript, ett dagstak per IP begränsar
// kostnaden om någon försöker ändå. Går tolkningen inte att göra (ingen nyckel,
// fel hos leverantören) svarar routen med tomma värden, och besökaren hamnar på
// resultatsidan med sin text som vanligt.
export async function POST(request) {
  const perMinut = await rateLimit(request, "ai-sok-minut", 6, 60);
  if (perMinut) return perMinut;
  const perDag = await rateLimit(request, "ai-sok-dag", 60, 86400);
  if (perDag) return perDag;

  let text = "";
  try {
    ({ text = "" } = await request.json());
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Beskriv kortfattat vad ni söker." }, { status: 400 });
  }
  text = text.trim().slice(0, MAX_TECKEN);

  try {
    const tolkat = await tolka(text);
    if (!tolkat) return NextResponse.json({ ...TOMT, tolkad: false });
    return NextResponse.json({ ...(await vidgaTillTraffar(tolkat)), tolkad: true });
  } catch (err) {
    console.error("AI-sök: tolkningen misslyckades:", err?.status ?? "", err?.message);
    return NextResponse.json({ ...TOMT, tolkad: false });
  }
}

// Tre filter tillsammans kan bli så smalt att inget bolag matchar, och en tom
// resultatsida är ett sämre svar än en lite bredare. Släpp därför filtren ett i
// taget, det minst avgörande först (tjänst, sedan ort), tills något bolag
// matchar. Yrkesområdet släpps sist.
async function vidgaTillTraffar(filter) {
  const steg = [
    filter,
    { ...filter, tjanst: "" },
    { ...filter, tjanst: "", ort: "" },
    TOMT,
  ];
  for (const f of steg) {
    if (!f.omrade && !f.tjanst && !f.ort) return TOMT;
    try {
      const { totalt } = await hamtaBolag({ ...f, antal: 1 });
      if (totalt > 0) return f;
    } catch (err) {
      console.error("AI-sök: kunde inte räkna träffar:", err?.message);
      return f;
    }
  }
  return TOMT;
}
