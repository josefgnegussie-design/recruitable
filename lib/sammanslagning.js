import { MAX_ADRESSER, normaliseraAdress, orterUrAdresser } from "@/lib/adresser";

// Sammanslagning av två bolag: ett upphör att visas, ett lever vidare.
//
// Reglerna bor här och inte i routen av samma skäl som lib/adresser.js: både
// bolagets begäran (/api/mina-sidor/sammanslagning) och granskarens beslut
// (/api/admin/sammanslagning) måste svara likadant på vad som går att slå ihop.
// Ligger kontrollen bara i den ena hittar bolaget hinder först efter att
// granskaren försökt verkställa.

export const SKAL = {
  fusion: "Fusion registrerad hos Bolagsverket",
  koncernbeslut: "Koncernen uppträder under ett namn",
  avregistrerad: "Bolaget är avregistrerat",
};

export function giltigtSkal(v) {
  return typeof v === "string" && Object.hasOwn(SKAL, v);
}

// Fälten båda bolagen behöver läsas med, i granskningskön och vid verkställandet.
const BOLAGSFALT =
  "id, name, slug, city, address, addresses, office_cities, org_number, link, " +
  "claimed, is_premium, merged_into, retired_at, retired_reason, deregistered_at";

// Ett bolag och de uppgifter ett beslut om det ska bygga på. Granskaren ska se
// grunden för beslutet i kön, inte behöva slå upp den i databasen.
export async function hamtaSammanslagningsbolag(admin, ids) {
  const unika = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  if (!unika.length) return {};

  const [bolag, kontor, admins, mottagare] = await Promise.all([
    admin.from("companies").select(BOLAGSFALT).in("id", unika),
    admin.from("offices").select("id, company_id, city, paid").in("company_id", unika),
    admin
      .from("company_admins")
      .select("id, company_id, user_id, ar_agare")
      .in("company_id", unika)
      .eq("verified", true),
    admin.from("inquiry_recipients").select("company_id").in("company_id", unika),
  ]);

  const per = Object.fromEntries(
    (bolag.data ?? []).map((b) => [
      b.id,
      {
        ...b,
        kontor: (kontor.data ?? []).filter((k) => k.company_id === b.id),
        administratorer: (admins.data ?? []).filter((a) => a.company_id === b.id),
        antalForfragningar: (mottagare.data ?? []).filter((r) => r.company_id === b.id).length,
      },
    ])
  );

  return per;
}

// Vad som hindrar att bolaget slås ihop. Tom lista betyder att det går.
//
// Premium och betalda kontor är samma fälla som vid radering av ett kontor: en
// prenumeration som löper vidare mot ett bolag som inte längre visas debiteras
// ändå. Uppsägningen sker i Stripes portal, och webhooken sätter flaggan.
export function hinderFor(bolag) {
  const hinder = [];
  if (!bolag) return ["Bolaget finns inte i registret."];

  if (bolag.retired_at) {
    hinder.push(
      bolag.merged_into
        ? `Bolaget är redan sammanslaget med bolag ${bolag.merged_into}.`
        : "Bolaget är redan taget ur registret."
    );
  }

  if (bolag.is_premium) {
    hinder.push(
      "Bolaget har en aktiv premiumprenumeration. Den måste sägas upp i Stripes portal först — " +
        "annars debiteras en profil som inte längre visas."
    );
  }

  const betalda = (bolag.kontor ?? []).filter((k) => k.paid);
  if (betalda.length) {
    hinder.push(
      `Bolaget har ${betalda.length} betalt kontor (${betalda.map((k) => k.city).join(", ")}). ` +
        "Säg upp kontorsprenumerationen i Stripes portal först."
    );
  }

  return hinder;
}

// Samma nyckel som två adresser måste dela för att räknas som samma adress.
function adressnyckel(a) {
  return [a.street, a.postal_code, a.city].map((v) => (v || "").toLowerCase()).join("|");
}

// Adresserna det överlevande bolaget ska ha efter sammanslagningen.
//
// Det här är hela poängen med att ärva något alls: utan Malmöadressen försvinner
// koncernen ur en sökning på Malmö i samma stund som Syd-kortet slutar visas,
// och sammanslagningen skulle kosta dem en ort. Saknar det upphörande bolaget
// egna adressrader — vilket nästan alla importerade gör — bevaras åtminstone
// orten, som är det sökningen läser.
export function slaSammanAdresser(overlevande, upphorande) {
  const bas = (overlevande.addresses ?? []).map(normaliseraAdress);
  const sedda = new Set(bas.map(adressnyckel));

  const inkommande = (upphorande.addresses ?? []).length
    ? upphorande.addresses.map(normaliseraAdress)
    : upphorande.city
      ? [normaliseraAdress({ street: "", postal_code: "", city: upphorande.city })]
      : [];

  const tillagda = [];
  for (const adress of inkommande) {
    const nyckel = adressnyckel(adress);
    if (sedda.has(nyckel)) continue;
    // Taket gäller lika mycket här som i formuläret — kolumnen valideras med
    // giltigaAdresser vid varje vanlig sparning, och en ärvd adress för mycket
    // skulle göra profilen osparbar för bolaget efteråt.
    if (bas.length + tillagda.length >= MAX_ADRESSER) break;
    sedda.add(nyckel);
    tillagda.push(adress);
  }

  const alla = [...bas, ...tillagda];
  return { adresser: alla, orter: orterUrAdresser(alla), tillagda };
}

// Verkställer sammanslagningen. Anropas bara av granskarens route.
//
// Ordningen är vald efter vad ett avbrott mitt i lämnar efter sig. Adresserna
// ärvs först (att lägga till en ort som redan finns i koncernen skadar inget),
// därefter märks bolaget som sammanslaget — och i den stunden är registret rätt.
// Kontor och administratörer flyttas sist: misslyckas det ligger de kvar på ett
// bolag som inte visas, vilket går att rätta för hand, medan ett omärkt bolag
// utan sina administratörer inte gör det.
export async function utforSammanslagning(admin, { companyId, survivorId, reason }) {
  if (!Number.isInteger(companyId) || !Number.isInteger(survivorId)) {
    return { fel: "Ogiltiga bolag." };
  }
  if (companyId === survivorId) {
    return { fel: "Ett bolag kan inte gå upp i sig självt." };
  }
  if (!giltigtSkal(reason)) {
    return { fel: "Ogiltigt skäl." };
  }

  const bolag = await hamtaSammanslagningsbolag(admin, [companyId, survivorId]);
  const upphorande = bolag[companyId];
  const overlevande = bolag[survivorId];

  if (!upphorande || !overlevande) {
    return { fel: "Ett av bolagen finns inte i registret." };
  }

  const hinder = hinderFor(upphorande);
  if (hinder.length) return { fel: hinder.join(" ") };

  // Det överlevande bolaget får inte självt ha upphört — då hade besökaren
  // skickats vidare till ett kort som inte visas. Databasen stoppar det också,
  // men felet ska vara läsbart och peka rätt.
  if (overlevande.retired_at) {
    return {
      fel: overlevande.merged_into
        ? `${overlevande.name} är självt sammanslaget med bolag ${overlevande.merged_into}. Välj det bolaget som överlevande i stället.`
        : `${overlevande.name} är taget ur registret och kan inte ta över ett annat bolag.`,
    };
  }

  const { adresser, orter, tillagda } = slaSammanAdresser(overlevande, upphorande);

  if (tillagda.length) {
    const { error } = await admin
      .from("companies")
      .update({ addresses: adresser, office_cities: orter })
      .eq("id", survivorId);

    if (error) {
      console.error("Kunde inte ärva adresserna:", JSON.stringify(error));
      return { fel: "Kunde inte flytta orterna till det överlevande bolaget. Inget är ändrat." };
    }
  }

  const { error: markFel } = await admin
    .from("companies")
    .update({
      merged_into: survivorId,
      retired_at: new Date().toISOString(),
      retired_reason: reason,
    })
    .eq("id", companyId);

  if (markFel) {
    console.error("Kunde inte märka bolaget som sammanslaget:", JSON.stringify(markFel));
    return { fel: markFel.message || "Kunde inte slå ihop bolagen. Försök igen." };
  }

  // ---- Härefter är registret rätt. Resten rapporteras, aldrig som ett fel. ----
  const anmarkningar = [];

  // Kontoren är obetalda (betalda stoppades av hinderFor) och pekar på riktiga
  // platser. De följer med bolaget de tillhör.
  const flyttadeKontor = upphorande.kontor.length;
  if (flyttadeKontor) {
    const { error } = await admin
      .from("offices")
      .update({ company_id: survivorId })
      .eq("company_id", companyId);
    if (error) {
      console.error("Kunde inte flytta kontoren:", JSON.stringify(error));
      anmarkningar.push(`Kontoren ligger kvar på ${upphorande.name} och måste flyttas för hand.`);
    }
  }

  // Administratörerna följer med, så att de som skött det upphörande bolagets
  // profil inte blir utelåsta. Ägarskapet släpps först: company_admins har ett
  // partiellt unikt index på en ägare per bolag, och en flytt med ar_agare = true
  // in i ett bolag som redan har en ägare stoppas av indexet.
  const befintliga = new Set(overlevande.administratorer.map((a) => a.user_id));
  let flyttadeAdmins = 0;

  for (const a of upphorande.administratorer) {
    // Samma person på båda bolagen: company_admins har unique (user_id,
    // company_id), så raden kan inte flyttas — och behövs inte.
    if (befintliga.has(a.user_id)) {
      const { error } = await admin.from("company_admins").delete().eq("id", a.id);
      if (error) anmarkningar.push(`Dubbletten för ${a.user_id} kunde inte tas bort.`);
      continue;
    }

    const { error } = await admin
      .from("company_admins")
      .update({ company_id: survivorId, ar_agare: false })
      .eq("id", a.id);

    if (error) {
      console.error("Kunde inte flytta administratören:", JSON.stringify(error));
      anmarkningar.push(`En administratör ligger kvar på ${upphorande.name} och måste flyttas för hand.`);
      continue;
    }
    flyttadeAdmins++;
  }

  return {
    resultat: {
      upphorande,
      overlevande,
      arvdaOrter: tillagda.map((a) => a.city),
      flyttadeKontor,
      flyttadeAdmins,
      anmarkningar,
    },
  };
}

export const ARENDESTATUS = {
  pending: "Väntar på granskning",
  approved: "Godkänd",
  rejected: "Nekad",
};

const ARENDEFALT =
  "id, company_id, survivor_id, reason, effective_date, message, status, " +
  "decision_note, decided_at, created_at";

// Sammanslagningsärendena som rör ett bolag — som upphörande eller överlevande.
//
// Namnen hämtas i en andra fråga i stället för som inbäddad tabell: merge_requests
// har två främmande nycklar till companies, och en inbäddning måste då namnge
// själva nyckelrestriktionen. Ett namn vi inte satt själva är inget att bygga en
// vy på. Tar emot vilken klient som helst, så att sidan kan läsa med besökarens
// egen session (RLS släpper igenom bolagets egna ärenden) och routen med service
// role.
export async function hamtaArenden(supabase, companyId) {
  if (!Number.isInteger(companyId)) return [];

  const { data, error } = await supabase
    .from("merge_requests")
    .select(ARENDEFALT)
    .or(`company_id.eq.${companyId},survivor_id.eq.${companyId}`)
    .order("created_at", { ascending: false });

  if (error) {
    // Saknas tabellen — koden driftsatt före migrationen — ska panelen visa
    // formuläret utan ärendehistorik, inte ett fel.
    console.warn("Kunde inte läsa sammanslagningsärenden:", error.message);
    return [];
  }

  const ids = [...new Set((data ?? []).flatMap((r) => [r.company_id, r.survivor_id]))];
  const { data: bolag } = ids.length
    ? await supabase.from("companies").select("id, name, city").in("id", ids)
    : { data: [] };
  const namn = Object.fromEntries((bolag ?? []).map((b) => [b.id, b]));

  return (data ?? []).map((r) => ({
    id: r.id,
    upphorande: namn[r.company_id] ?? { id: r.company_id, name: `Bolag ${r.company_id}` },
    overlevande: namn[r.survivor_id] ?? { id: r.survivor_id, name: `Bolag ${r.survivor_id}` },
    viUpphor: r.company_id === companyId,
    skal: r.reason,
    skalText: SKAL[r.reason] ?? r.reason,
    datum: r.effective_date,
    meddelande: r.message,
    status: r.status,
    statusText: ARENDESTATUS[r.status] ?? r.status,
    beslutsnot: r.decision_note,
    beslutat: r.decided_at,
    skapat: r.created_at,
  }));
}

// Vilka av de angivna id:na pekar på ett sammanslaget bolag?
//
// Egen fråga med mjuk landning i stället för ett filter i anroparens SELECT:
// saknas kolumnen — koden driftsatt före migrationen — ska svaret bli "inga
// sammanslagna" och flödet fortsätta, inte falla. Se SENA_KOLUMNER i
// lib/companiesRepo.js, som finns för exakt samma glapp.
export async function upphordaAv(supabase, ids) {
  const unika = [...new Set((ids ?? []).filter((id) => Number.isInteger(id)))];
  if (!unika.length) return [];

  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .in("id", unika)
    .not("retired_at", "is", null);

  if (error) {
    console.warn("Kunde inte kontrollera upphörda bolag:", error.message);
    return [];
  }

  return (data ?? []).map((r) => r.id);
}

// Tar ett bolag ur registret utan efterträdare.
//
// Det vanliga fallet efter en avregistrering: bolaget har upphört och verksamheten
// har inte gått över till någon annan. Profilen finns kvar och visar beskedet att
// bolaget avregistrerats — det är vad den som söker efter bolaget behöver veta —
// men det syns inte i sökningen och kan inte ta emot en förfrågan.
//
// Ingen flytt av kontor eller administratörer: det finns ingenstans att flytta
// dem. Administratörerna behåller sin inloggning och sin profil.
export async function taUrRegistret(admin, { companyId, reason = "avregistrerad" }) {
  if (!Number.isInteger(companyId)) return { fel: "Ogiltigt bolag." };
  if (!giltigtSkal(reason)) return { fel: "Ogiltigt skäl." };

  const bolag = await hamtaSammanslagningsbolag(admin, [companyId]);
  const upphorande = bolag[companyId];

  const hinder = hinderFor(upphorande);
  if (hinder.length) return { fel: hinder.join(" ") };

  const { error } = await admin
    .from("companies")
    .update({ retired_at: new Date().toISOString(), retired_reason: reason })
    .eq("id", companyId);

  if (error) {
    console.error("Kunde inte ta bolaget ur registret:", JSON.stringify(error));
    return { fel: error.message || "Kunde inte ta bolaget ur registret. Försök igen." };
  }

  return { resultat: { upphorande } };
}
