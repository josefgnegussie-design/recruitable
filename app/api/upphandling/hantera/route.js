import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaForToken, UUID_RE } from "@/lib/upphandlingRepo";
import { sendUpphandlingBesked } from "@/lib/emailUpphandling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SVAR = 1000;

// Köparens tre åtgärder. Länken är köparens enda legitimation, så token avgör
// vilken upphandling det gäller och raden som ändras måste höra till den.
// Ett id ur begäran räcker aldrig ensamt.
export async function POST(request) {
  const limited = await rateLimit(request, "upphandling-hantera", 120, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { token, atgard } = body;
  const admin = createAdminClient();
  const u = await hamtaForToken(
    admin,
    token,
    "id, title, closed_at, moderation_status, requester_name, requester_email, requester_company, requester_phone"
  );
  if (!u) return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  if (u.moderation_status !== "approved") {
    return NextResponse.json({ error: "Upphandlingen är inte publicerad." }, { status: 409 });
  }

  if (atgard === "kortlista") {
    const { intresseId, pa } = body;
    if (typeof intresseId !== "string" || !UUID_RE.test(intresseId) || typeof pa !== "boolean") {
      return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
    }
    if (u.closed_at) return NextResponse.json({ error: "Upphandlingen är avslutad." }, { status: 409 });
    const { error } = await admin
      .from("procurement_interests")
      .update({ status: pa ? "kortlista" : "anmald" })
      .eq("id", intresseId)
      .eq("procurement_id", u.id);
    if (error) {
      console.error("Kunde inte ändra kortlistan:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte spara." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (atgard === "svara") {
    const { fragaId, svar } = body;
    if (typeof fragaId !== "string" || !UUID_RE.test(fragaId)) {
      return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
    }
    if (typeof svar !== "string" || !svar.trim() || svar.length > MAX_SVAR) {
      return NextResponse.json({ error: `Svaret måste vara mellan 1 och ${MAX_SVAR} tecken.` }, { status: 400 });
    }
    const { error } = await admin
      .from("procurement_questions")
      .update({ answer: svar.trim(), answered_at: new Date().toISOString() })
      .eq("id", fragaId)
      .eq("procurement_id", u.id);
    if (error) {
      console.error("Kunde inte spara svaret:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte spara." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (atgard === "avsluta") {
    if (u.closed_at) return NextResponse.json({ error: "Upphandlingen är redan avslutad." }, { status: 409 });

    // Villkoret på closed_at gör att två samtidiga klick inte båda skickar besked.
    const { data: stangd, error } = await admin
      .from("procurements")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", u.id)
      .is("closed_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Kunde inte avsluta upphandlingen:", JSON.stringify(error));
      return NextResponse.json({ error: "Kunde inte avsluta." }, { status: 500 });
    }
    if (!stangd) return NextResponse.json({ error: "Upphandlingen är redan avslutad." }, { status: 409 });

    const { data: anmalningar } = await admin
      .from("procurement_interests")
      .select("id, status, contact_email")
      .eq("procurement_id", u.id);

    const kopare = {
      foretag: u.requester_company,
      namn: u.requester_name,
      epost: u.requester_email,
      telefon: u.requester_phone,
    };

    after(async () => {
      for (const a of anmalningar || []) {
        const resultat = await sendUpphandlingBesked({
          till: a.contact_email,
          titel: u.title,
          vidare: a.status === "kortlista",
          kopare,
        });
        if (resultat && !resultat.error) {
          const { error: stampelFel } = await admin
            .from("procurement_interests")
            .update({ decision_notified_at: new Date().toISOString() })
            .eq("id", a.id);
          if (stampelFel) console.error(`Kunde inte stämpla beskedet för ${a.id}:`, JSON.stringify(stampelFel));
        }
      }
    });

    return NextResponse.json({ ok: true, besked: (anmalningar || []).length });
  }

  return NextResponse.json({ error: "Okänd åtgärd." }, { status: 400 });
}
