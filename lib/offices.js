import { createAdminClient } from "@/lib/supabase/admin";

// Orterna är fritext på båda sidor — besökaren skriver sin egen ort i ett fält
// med datalist, och bolaget skriver kontorets ort i sitt eget formulär — så
// jämförelsen görs på trimmad gemenform. Den gjordes tidigare med ilike direkt
// i frågan, med en escape-funktion som inte escapade (`\${t}` i en template
// literal blir texten "${t}", inte "\%"). Nu hämtas bolagets betalda kontor och
// jämförelsen sker här, vilket också gör det möjligt att rangordna flera orter.
function normalisera(ort) {
  return typeof ort === "string" ? ort.trim().toLowerCase() : "";
}

// Slår upp rätt mottagare för en förfrågan, ett bolag i taget i samma svep: om
// bolaget har ett betalt kontor (offices.paid = true) vars ort matchar, går
// förfrågan till kontorets egen kontaktperson (t.ex. kontorschefen i
// Falkenberg) istället för bolagets generella kontakt.
//
// `orter` är en prioritetsordning, inte en mängd: förfrågans ort (den besökaren
// filtrerade på, och som avgjorde vilka bolag som ens visades) före avsändarens
// egen ort. En Stockholmsköpare som söker bemanning till sitt lager i
// Falkenberg ska nå Falkenbergskontoret — tidigare matchades bara avsändarens
// egen ort, så den förfrågan gick till Stockholmskontoret.
//
// Alla kontor hämtas i en fråga och inte en per bolag — en förfrågan går ofta
// till ett tiotal bolag, och modereringen ska inte sitta och vänta på tio
// tur-och-retur mot databasen i tur och ordning.
//
// bolag: [{ id, name, contact }]. Bolag utan kontaktadress faller bort, så
// listan som kommer tillbaka är precis de som går att mejla.
export async function resolveCompanyContacts(bolag, orter) {
  const kontor = new Map();

  const prioriterade = [];
  for (const ort of Array.isArray(orter) ? orter : [orter]) {
    const n = normalisera(ort);
    if (n && !prioriterade.includes(n)) prioriterade.push(n);
  }

  if (prioriterade.length && bolag.length) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("offices")
      .select("id, company_id, city, contact_name, contact_email")
      .in(
        "company_id",
        bolag.map((b) => b.id)
      )
      .eq("paid", true);

    if (error) {
      // Kontorsuppslaget är en förbättring, inte en förutsättning. Går det inte
      // vägen ska förfrågan ändå nå bolagets generella adress.
      console.error("Kunde inte slå upp kontor för förfrågan:", JSON.stringify(error));
    }

    for (const rad of data || []) {
      if (!rad.contact_email) continue;
      const rang = prioriterade.indexOf(normalisera(rad.city));
      if (rang === -1) continue;

      // Lägre rang vinner: kontoret på förfrågans ort går före kontoret på
      // avsändarens. Bara det första kontoret per ort och bolag används.
      const nuvarande = kontor.get(rad.company_id);
      if (!nuvarande || rang < nuvarande.rang) {
        kontor.set(rad.company_id, {
          rang,
          id: rad.id,
          namn: rad.contact_name,
          email: rad.contact_email,
        });
      }
    }
  }

  // officeId följer med ut så att anroparen kan spara vilket kontor förfrågan
  // routades till — se migration_forfragan_routing.sql. Den är null när
  // förfrågan gick till bolagets generella adress.
  return bolag
    .map((b) => {
      const traff = kontor.get(b.id);
      const email = traff?.email || b.contact;
      return email
        ? {
            companyId: b.id,
            companyName: b.name,
            email,
            officeId: traff?.id ?? null,
            viaKontor: Boolean(traff),
          }
        : null;
    })
    .filter(Boolean);
}
