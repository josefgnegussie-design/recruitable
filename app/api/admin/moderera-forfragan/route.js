import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { resolveCompanyContacts } from "@/lib/offices";
import { sendInquiryReceivedToCompany } from "@/lib/email";
import { fornamn } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DECISIONS = new Set(["approved", "rejected"]);

// Recruitables egen granskning av nyinkomna förfrågningar — ingen förfrågan
// syns för något bolag (inte ens redigerad) förrän den godkänts här. Se
// moderation_status i migration_inquiry_moderation.sql.
//
// Godkännandet är också det som mejlar de valda bolagen. Mejlet hör hit och
// inte till /api/forfragan/skicka: skickas det vid inlämning har granskningen
// ingen verkan, eftersom bolaget redan fått förfrågan i mejlkorgen.
export async function POST(request) {
  const limited = await rateLimit(request, "admin-moderera-forfragan", 60, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { inquiryId, decision } = body;
  if (typeof inquiryId !== "string" || !inquiryId || !VALID_DECISIONS.has(decision)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Hämtar redan nu det mejlet behöver. En andra rundtur efter uppdateringen
  // hade gett samma uppgifter, och det här svaret behövs ändå för kontrollen
  // att förfrågan inte redan är hanterad.
  const { data: inquiry } = await admin
    .from("inquiries")
    .select(
      "moderation_status, description, search_role, focus_area, service, city, region, " +
        "requester_name, requester_role, requester_company, requester_city, " +
        "inquiry_recipients(company_id, companies(id, name, contact, claimed))"
    )
    .eq("id", inquiryId)
    .maybeSingle();

  if (!inquiry) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  if (inquiry.moderation_status !== "pending") {
    return NextResponse.json({ error: "Förfrågan är redan hanterad." }, { status: 400 });
  }

  // moderated_at är tidpunkten förfrågan blev synlig för bolagen, och därmed
  // den som avgör vilken månad den hör till i faktureringsunderlaget.
  // created_at duger inte: en förfrågan som kommer in sista dagen i månaden
  // och godkänns dagen efter hade annars fakturerats fel månad.
  const { error } = await admin
    .from("inquiries")
    .update({ moderation_status: decision, moderated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  if (error) {
    console.error("Kunde inte uppdatera moderation_status:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }

  if (decision !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const valdaBolag = (inquiry.inquiry_recipients || []).map((r) => r.companies).filter(Boolean);

  // Bara bolag som kan göra något med mejlet får det: de har tagit över sin
  // profil. Ett bolag som inte registrerat sig kan varken logga in och
  // acceptera eller förvänta sig mejl från oss — det hör till
  // informationsutskicket till registret, inte hit.
  //
  // Kravet på companies.contact låg tidigare här, vilket sållade bort bolag
  // innan kontoren ens slogs upp: ett betalt kontor med egen kontaktperson fick
  // då inget mejl bara för att bolaget saknade generell adress. Adressfrågan
  // hör hemma i resolveCompanyContacts, som faller tillbaka på bolagets adress
  // och släpper den utan adress helt.
  const kanSvara = valdaBolag.filter((b) => b.claimed);

  // Förfrågans ort först, avsändarens egen bara som reserv. inquiries.city är
  // orten besökaren filtrerade på — alltså den uppdraget gäller, och den som
  // avgjorde vilka bolag som ens visades. requester_city är var avsändaren
  // själv sitter, vilket inte behöver vara samma sak: en Stockholmsköpare kan
  // söka bemanning till ett lager i Falkenberg. Fältet är frivilligt i
  // formuläret, därför reserven.
  const mottagare = await resolveCompanyContacts(kanSvara, [inquiry.city, inquiry.requester_city]);

  // Mejlet går till bolagen INNAN de accepterat, så det får inte bära något som
  // pekar ut kunden. Bolagsnamn och kundens ort lämnades tidigare ut här; nu
  // skickas behovet, uppdragets plats, och vem som frågar till förnamn och roll.
  // Samma gräns som mapInquiryRow drar i gränssnittet.
  const forMejl = {
    description: inquiry.description,
    searchRole: inquiry.search_role || "",
    focusArea: inquiry.focus_area || "",
    service: inquiry.service || "",
    city: inquiry.city || "",
    region: inquiry.region || "",
    requesterFirstName: fornamn(inquiry.requester_name),
    requesterRole: inquiry.requester_role || "",
  };

  // Två bolag i samma koncern kan dela kontaktadress, och mejlet handlar om
  // förfrågan och inte om det enskilda bolaget — samma adress ska då ha ett mejl
  // och inte två identiska.
  const adresser = [...new Map(mottagare.map((m) => [m.email.toLowerCase(), m])).values()];

  // Routningsbeslutet sparas innan mejlen går ut: vilket kontor förfrågan
  // hamnade hos och på vilken adress. Uträkningen gjordes tidigare i minnet och
  // kastades, så varken vi eller det betalande bolaget kunde i efterhand se om
  // kontoret faktiskt fick sin förfrågan. Se migration_forfragan_routing.sql.
  if (mottagare.length) {
    const { error: routningsFel } = await admin.from("inquiry_recipients").upsert(
      mottagare.map((m) => ({
        inquiry_id: inquiryId,
        company_id: m.companyId,
        office_id: m.officeId,
        notified_email: m.email,
      })),
      { onConflict: "inquiry_id,company_id" }
    );

    // Utskicket ska gå ut även om kvittot inte kan sparas, men tystnad vore
    // fel väg: en saknad kolumn betyder att migrationen inte körts, och det
    // har gått obemärkt förbi förr.
    if (routningsFel) {
      const saknadKolumn = routningsFel.code === "42703" || routningsFel.code === "PGRST204";
      console.error(
        saknadKolumn
          ? "inquiry_recipients saknar routningskolumnerna — kör supabase/migration_forfragan_routing.sql."
          : `Kunde inte spara routningen för förfrågan ${inquiryId}: ${JSON.stringify(routningsFel)}`
      );
    }
  }

  // after() och inte fire-and-forget: registreringsnotisen försvann spårlöst i
  // produktion just för att utskicket startades utan await, och funktionen
  // frystes i samma ögonblick svaret gick iväg.
  if (adresser.length) {
    after(async () => {
      const utfall = await Promise.allSettled(
        adresser.map((m) => sendInquiryReceivedToCompany({ to: m.email, inquiry: forMejl }))
      );

      // notified_at sätts först här, och bara för adresser som verkligen tog
      // emot mejlet. En mottagare med adress men utan tid är alltså ett mejl
      // som inte gick fram — förut syntes det bara som en rad i loggen.
      const framme = new Set(
        adresser.filter((_, i) => utfall[i].status === "fulfilled").map((m) => m.email.toLowerCase())
      );
      const bolagMedMejl = mottagare
        .filter((m) => framme.has(m.email.toLowerCase()))
        .map((m) => m.companyId);

      if (bolagMedMejl.length) {
        const { error: tidsFel } = await admin
          .from("inquiry_recipients")
          .update({ notified_at: new Date().toISOString() })
          .eq("inquiry_id", inquiryId)
          .in("company_id", bolagMedMejl);
        if (tidsFel) console.error(`Kunde inte stämpla utskicket för ${inquiryId}:`, JSON.stringify(tidsFel));
      }

      const fel = utfall.filter((u) => u.status === "rejected").length;
      if (fel) console.error(`Förfrågan ${inquiryId}: ${fel} av ${adresser.length} mejl gick inte ut.`);
    });
  }

  return NextResponse.json({
    ok: true,
    mejlade: mottagare.length,
    viaKontor: mottagare.filter((m) => m.viaKontor).length,
    utanMottagare: valdaBolag.length - mottagare.length,
  });
}
