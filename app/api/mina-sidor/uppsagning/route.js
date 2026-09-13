import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { FRITEXT_MAX, GILTIGA_SKAL, SKAL_MED_FRITEXT } from "@/lib/uppsagning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAGAR = 90;

// Ägaren till bolagets konto, eller ett felsvar. Uppsägningen är ägarens sak av
// samma skäl som betalningen är det — se app/api/stripe/portal/route.js.
async function kravAgare() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { fel: NextResponse.json({ error: "Inte inloggad." }, { status: 401 }) };

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified, ar_agare")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow?.verified || !adminRow.company_id) {
    return { fel: NextResponse.json({ error: "Inte behörig." }, { status: 403 }) };
  }
  if (!adminRow.ar_agare) {
    return {
      fel: NextResponse.json({ error: "Bara kontots ägare kan säga upp prenumerationen." }, { status: 403 }),
    };
  }

  return { user, companyId: adminRow.company_id };
}

// Vad bolaget fått ut den senaste tiden. Räknar mottagarrader för godkända
// förfrågningar — en förfrågan vi själva nekat har aldrig nått bolaget och ska
// inte räknas som något de fått.
async function hamtaUtfall(admin, companyId) {
  const sedan = new Date(Date.now() - DAGAR * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("inquiry_recipients")
    .select("status, inquiries!inner(moderation_status)")
    .eq("company_id", companyId)
    .eq("inquiries.moderation_status", "approved")
    .gte("created_at", sedan);

  if (error) {
    // Siffrorna är ett stöd i beslutet, inte en förutsättning för att få säga
    // upp. Går uppslaget fel visas rutan utan dem.
    console.error("Kunde inte räkna förfrågningar inför uppsägning:", JSON.stringify(error));
    return null;
  }

  const rader = data || [];
  return {
    dagar: DAGAR,
    forfragningar: rader.length,
    accepterade: rader.filter((r) => r.status === "accepted").length,
  };
}

export async function GET() {
  const { fel, companyId } = await kravAgare();
  if (fel) return fel;

  return NextResponse.json({ utfall: await hamtaUtfall(createAdminClient(), companyId) });
}

// Sparar skälet och lämnar sedan över till Stripes portal, där uppsägningen
// faktiskt sker. Skälet sparas FÖRE överlämningen: den som ångrar sig i portalen
// har ändå berättat varför de var på väg, och det är den uppgiften vi vill ha.
export async function POST(request) {
  const limited = await rateLimit(request, "mina-sidor-uppsagning", 20, 3600);
  if (limited) return limited;

  const { fel, user, companyId } = await kravAgare();
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  if (typeof body.reason !== "string" || !GILTIGA_SKAL.has(body.reason)) {
    return NextResponse.json({ error: "Välj ett skäl i listan." }, { status: 400 });
  }

  // Fritexten hör till "annat" och sparas bara därifrån. Ett skäl ur listan
  // med en avvikande text bredvid hade varit två svar på samma fråga.
  const fritext =
    body.reason === SKAL_MED_FRITEXT && typeof body.reasonText === "string"
      ? body.reasonText.trim().slice(0, FRITEXT_MAX) || null
      : null;

  const admin = createAdminClient();
  const utfall = await hamtaUtfall(admin, companyId);

  const rad = {
    company_id: companyId,
    user_id: user.id,
    reason: body.reason,
    reason_text: fritext,
    forfragningar_90d: utfall?.forfragningar ?? null,
    accepterade_90d: utfall?.accepterade ?? null,
  };

  let { error } = await admin.from("cancellation_feedback").insert(rad);

  // Kolumnen kom i en senare migration än tabellen. Har den inte körts sparas
  // raden utan fritexten i stället för att svaret går förlorat helt.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    console.error("cancellation_feedback.reason_text saknas — kör migrationen. Sparar utan fritext.");
    const { reason_text, ...utanFritext } = rad;
    ({ error } = await admin.from("cancellation_feedback").insert(utanFritext));
  }

  if (error) {
    if (error.code === "42P01") {
      console.error("cancellation_feedback saknas — kör migration_uppsagningsorsak.sql.");
      return NextResponse.json(
        { error: "Databasen saknar tabellen för uppsägningsskäl. Kör migrationen." },
        { status: 500 }
      );
    }
    console.error("Kunde inte spara uppsägningsskäl:", JSON.stringify(error));
    // Ett misslyckat svar här får inte hindra någon från att säga upp. Skälet är
    // vår nyfikenhet, uppsägningen är deras rätt.
  }

  return NextResponse.json({ ok: true });
}
