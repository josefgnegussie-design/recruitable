import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { hittaAnvandare, stamplaBolagsadmin } from "@/lib/bolagsadmin";
import { hamtaOppenInbjudan } from "@/lib/inbjudningar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Löser in en inbjudan: kopplar den inbjudna adressen som verifierad
// administratör för bolaget, och skapar kontot om det inte finns.
//
// Ingen inloggning krävs för att nå hit — token i länken är beviset. Den gick
// bara ut till den inbjudna adressen, så den som har den har läst mejlet, vilket
// är samma bevis som en bekräftelselänk vid registreringen ger. Därför skapas
// kontot med bekräftad e-post.
//
// Lösenordet är frivilligt. Utan det loggar kollegan in med en kod via mejl.
// För ett konto som redan finns sätts inget lösenord här; det befintliga gäller.
export async function POST(request) {
  const limited = await rateLimit(request, "inbjudan-anta", 10, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { token, losenord } = body;
  if (losenord !== undefined && losenord !== null && (typeof losenord !== "string" || losenord.length < 8 || losenord.length > 72)) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 8 tecken." }, { status: 400 });
  }

  const admin = createAdminClient();
  const inbjudan = await hamtaOppenInbjudan(admin, token);
  if (!inbjudan) {
    return NextResponse.json({ error: "Inbjudan har gått ut, återkallats eller redan använts." }, { status: 404 });
  }

  // Inbjudan tas i anspråk först, villkorat på att den fortfarande är öppen,
  // så att två samtidiga klick inte båda kan lösa in den.
  const { data: tagen } = await admin
    .from("bolagsinbjudningar")
    .update({ antagen_at: new Date().toISOString() })
    .eq("id", inbjudan.id)
    .is("antagen_at", null)
    .is("aterkallad_at", null)
    .select("id");

  if (!tagen?.length) {
    return NextResponse.json({ error: "Inbjudan har gått ut, återkallats eller redan använts." }, { status: 404 });
  }

  // Går något fel efter det här öppnas inbjudan igen, så att länken går att
  // försöka med på nytt i stället för att vara förbrukad utan resultat.
  async function oppnaIgen(meddelande, status = 500) {
    await admin.from("bolagsinbjudningar").update({ antagen_at: null }).eq("id", inbjudan.id);
    return NextResponse.json({ error: meddelande }, { status });
  }

  let anvandare = await hittaAnvandare(admin, inbjudan.epost);
  const nyttKonto = !anvandare;

  if (nyttKonto) {
    const { data, error } = await admin.auth.admin.createUser({
      email: inbjudan.epost,
      email_confirm: true,
      ...(losenord ? { password: losenord } : {}),
    });
    if (error || !data?.user) {
      console.error("Kunde inte skapa konto för inbjudan:", error?.message);
      return oppnaIgen("Kunde inte skapa kontot. Försök igen.");
    }
    anvandare = data.user;
  }

  const { data: befintlig } = await admin
    .from("company_admins")
    .select("id, company_id")
    .eq("user_id", anvandare.id)
    .maybeSingle();

  if (befintlig?.company_id && befintlig.company_id !== inbjudan.company_id) {
    return oppnaIgen(
      "Adressen administrerar redan ett annat bolag. Hör av er till info@recruitable.se så hjälper vi till.",
      409
    );
  }

  // Finns en oavslutad ansökan uppdateras den i stället för att en andra rad
  // skapas — annars hamnar kollegan både i granskningskön och bland bolagets
  // administratörer.
  if (!befintlig || !befintlig.company_id) {
    const skrivning = befintlig
      ? admin
          .from("company_admins")
          .update({ company_id: inbjudan.company_id, verified: true, ar_agare: false })
          .eq("id", befintlig.id)
      : admin
          .from("company_admins")
          .insert({ user_id: anvandare.id, company_id: inbjudan.company_id, verified: true, ar_agare: false });

    const { error } = await skrivning;
    if (error) {
      console.error("Kunde inte koppla inbjuden administratör:", JSON.stringify(error));
      return oppnaIgen("Kunde inte koppla kontot till bolaget. Försök igen.");
    }
  }

  await stamplaBolagsadmin(admin, anvandare.id);

  return NextResponse.json({
    ok: true,
    epost: inbjudan.epost,
    // Klienten loggar in direkt med lösenordet om ett nytt sattes, annars
    // skickas kollegan till inloggningen med kod.
    harLosenord: Boolean(nyttKonto && losenord),
  });
}
