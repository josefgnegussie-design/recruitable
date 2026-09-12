import { createAdminClient } from "@/lib/supabase/admin";

// Tecken som betyder något i ett LIKE-mönster. Ortsnamnet kommer från
// besökarens formulär, och ett "%" där skulle annars matcha bolagets kontor i
// alla orter istället för den som efterfrågats.
function somLiteral(text) {
  return text.replace(/[\%_]/g, (t) => `\${t}`);
}

// Slår upp rätt mottagare för en förfrågan, ett bolag i taget i samma svep: om
// bolaget har ett betalt kontor (offices.paid = true) vars ort matchar
// förfrågans ort, går den till kontorets egen kontaktperson (t.ex.
// kontorschefen i Falkenberg) istället för bolagets generella kontakt.
//
// Alla kontor hämtas i en fråga och inte en per bolag — en förfrågan går ofta
// till ett tiotal bolag, och modereringen ska inte sitta och vänta på tio
// tur-och-retur mot databasen i tur och ordning.
//
// bolag: [{ id, name, contact }]. Bolag utan kontaktadress faller bort, så
// listan som kommer tillbaka är precis de som går att mejla.
export async function resolveCompanyContacts(bolag, requesterCity) {
  const kontor = new Map();
  const ort = requesterCity?.trim();

  if (ort && bolag.length) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("offices")
      .select("company_id, contact_name, contact_email")
      .in(
        "company_id",
        bolag.map((b) => b.id)
      )
      .eq("paid", true)
      .ilike("city", somLiteral(ort));

    if (error) {
      // Kontorsuppslaget är en förbättring, inte en förutsättning. Går det inte
      // vägen ska förfrågan ändå nå bolagets generella adress.
      console.error("Kunde inte slå upp kontor för förfrågan:", JSON.stringify(error));
    }

    for (const rad of data || []) {
      if (rad.contact_email && !kontor.has(rad.company_id)) {
        kontor.set(rad.company_id, { namn: rad.contact_name, email: rad.contact_email });
      }
    }
  }

  return bolag
    .map((b) => {
      const traff = kontor.get(b.id);
      const email = traff?.email || b.contact;
      return email ? { companyId: b.id, companyName: b.name, email, viaKontor: Boolean(traff) } : null;
    })
    .filter(Boolean);
}
