import { after, NextResponse } from "next/server";
import { kravBolagsadmin } from "@/lib/bolagsadmin";
import { rateLimit } from "@/lib/rateLimit";
import { arOppen, idag } from "@/lib/upphandling";
import { UUID_RE } from "@/lib/upphandlingRepo";
import { sendUpphandlingNyFraga } from "@/lib/emailUpphandling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FRAGA = 500;

// En leverantörs fråga till köparen. Bara inloggade bolag får fråga, men köparen
// ser aldrig vem som frågade, och frågan syns för andra först när den är besvarad.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-fraga", 20, 3600);
  if (limited) return limited;

  const { fel, admin, rad } = await kravBolagsadmin();
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { upphandlingId, fraga } = body;
  if (typeof upphandlingId !== "string" || !UUID_RE.test(upphandlingId)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  if (typeof fraga !== "string" || !fraga.trim() || fraga.length > MAX_FRAGA) {
    return NextResponse.json({ error: `Frågan måste vara mellan 1 och ${MAX_FRAGA} tecken.` }, { status: 400 });
  }

  const { data: u } = await admin
    .from("procurements")
    .select("id, title, moderation_status, closed_at, interest_deadline, questions_deadline, requester_email")
    .eq("id", upphandlingId)
    .maybeSingle();

  if (!u || u.moderation_status !== "approved") return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  if (!arOppen(u) || u.questions_deadline < idag()) {
    return NextResponse.json({ error: "Sista dag för frågor har passerat." }, { status: 409 });
  }

  const { error } = await admin
    .from("procurement_questions")
    .insert({ procurement_id: u.id, company_id: rad.company_id, question: fraga.trim() });

  if (error) {
    console.error("Kunde inte spara frågan:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara frågan." }, { status: 500 });
  }

  after(() => sendUpphandlingNyFraga({ till: u.requester_email, titel: u.title, fraga: fraga.trim() }));

  return NextResponse.json({ ok: true });
}
