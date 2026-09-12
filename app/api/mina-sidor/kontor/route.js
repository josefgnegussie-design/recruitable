import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(v, max) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

// Kontor gick tidigare bara att lägga till, aldrig ändra eller ta bort —
// OfficesManager höll dem i en useState utan setter. Ett felstavat
// kontaktmejl gick alltså inte att rätta, trots att det är den adressen som
// tar emot ortens förfrågningar (se resolveCompanyContact i lib/offices.js).
//
// Skrivningen går via service role och inte via användarens session, trots att
// /api/profil/grunduppgifter gör tvärtom. Skälet är att offices bär betalstatus:
// en RLS-policy som släpper in inloggade admins på update skulle låta dem sätta
// paid = true på sig själva, och RLS kan inte begränsa vilka kolumner som får
// skrivas. Här räknas fälten upp i stället, och paid och stripe-kolumnerna rörs
// aldrig — de sätts bara av webhooken.
async function behorigFor(officeId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { fel: NextResponse.json({ error: "Inte inloggad." }, { status: 401 }) };

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow?.verified || !adminRow.company_id) {
    return { fel: NextResponse.json({ error: "Inte behörig." }, { status: 403 }) };
  }

  const admin = createAdminClient();
  const { data: kontor } = await admin
    .from("offices")
    .select("id, company_id, paid, city")
    .eq("id", officeId)
    .maybeSingle();

  // Samma svar oavsett om kontoret saknas eller tillhör någon annan — annars
  // går det att lista ut vilka id som finns genom att prova sig fram.
  if (!kontor || kontor.company_id !== adminRow.company_id) {
    return { fel: NextResponse.json({ error: "Hittades inte." }, { status: 404 }) };
  }

  return { admin, kontor };
}

export async function PATCH(request) {
  const limited = await rateLimit(request, "mina-sidor-kontor", 60, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { officeId, city, address, contactName, contactEmail } = body;

  if (
    typeof officeId !== "string" ||
    !officeId ||
    !text(city, 100) ||
    !text(contactName, 100) ||
    typeof contactEmail !== "string" ||
    contactEmail.length > 254 ||
    !EMAIL_RE.test(contactEmail) ||
    (address !== undefined && address !== null && (typeof address !== "string" || address.length > 300))
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  const { fel, admin } = await behorigFor(officeId);
  if (fel) return fel;

  const { data, error } = await admin
    .from("offices")
    .update({
      city: city.trim(),
      address: address?.trim() || null,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
    })
    .eq("id", officeId)
    .select("id, city, address, contact_name, contact_email, is_headquarters, paid, created_at")
    .maybeSingle();

  if (error) {
    console.error("Kunde inte uppdatera kontoret:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ kontor: data });
}

export async function DELETE(request) {
  const limited = await rateLimit(request, "mina-sidor-kontor", 60, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { officeId } = body;
  if (typeof officeId !== "string" || !officeId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { fel, admin, kontor } = await behorigFor(officeId);
  if (fel) return fel;

  // Ett betalt kontor har en löpande prenumeration hos Stripe. Raderas raden
  // här fortsätter debiteringen mot ett kontor som inte längre finns, och
  // bolaget skulle få betala för ingenting. Uppsägningen sker i Stripes egen
  // portal; webhooken sätter då paid = false (customer.subscription.deleted),
  // och därefter går kontoret att ta bort.
  if (kontor.paid) {
    return NextResponse.json(
      {
        error:
          "Kontoret har en aktiv prenumeration. Säg upp den under Hantera prenumeration först — då kan kontoret tas bort.",
      },
      { status: 409 }
    );
  }

  const { error } = await admin.from("offices").delete().eq("id", officeId);

  if (error) {
    console.error("Kunde inte ta bort kontoret:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte ta bort. Försök igen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
