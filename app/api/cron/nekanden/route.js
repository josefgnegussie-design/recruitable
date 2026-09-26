import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fornamn } from "@/lib/inquiries";
import { sendDeclineSummaryToRequester } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Ett tak per körning. Sammanställningarna är få — en per förfrågan som fått
// nya nekanden sedan i går — men taket hindrar att en oväntad köbildning gör
// att funktionen dödas mitt i och halva mängden märks som rapporterad.
const MAX_PER_KORNING = 50;

// Skickar dygnets sammanställning över bolag som tackat nej.
//
// Accept går direkt från /api/mina-sidor/forfragan-status: kunden ska veta
// samma stund att någon hör av sig. Ett nej väntar hit. Skälet är kundens
// upplevelse — den som frågat tio bolag får annars tio nej i rad, var och en en
// liten besvikelse, och inget av dem säger något om helheten. Ett samlat besked
// kan säga "tre av fem har tackat nej, ett har tackat ja", vilket är den enda
// uppgift kunden faktiskt kan handla på.
//
// Ett bolag som dröjer längre än ett dygn kommer med i nästa dygns
// sammanställning. Därför grupperas mängden per förfrågan och inte per dag:
// varje körning tar det som nekats sedan sist, oavsett hur gammal förfrågan är.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET saknas — nekandesammanställningen vägrar köra oskyddad.");
    return NextResponse.json({ error: "Saknar konfiguration." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const admin = createAdminClient();

  // Orapporterade nekanden. decline_reported_at är markören: null betyder
  // "nekat, men kunden vet inte än".
  const { data: nekanden, error } = await admin
    .from("inquiry_recipients")
    .select("id, inquiry_id, company_id, responded_at, response_message, companies(name)")
    .eq("status", "declined")
    .is("decline_reported_at", null)
    .order("responded_at", { ascending: true });

  if (error) {
    console.error("Kunde inte läsa nekandena:", JSON.stringify(error));
    return NextResponse.json(
      { error: "Kunde inte läsa nekandena. Är supabase/migration_nekanden_sammanstallning.sql körd?" },
      { status: 500 }
    );
  }

  if (!nekanden?.length) {
    return NextResponse.json({ sammanstallningar: 0, nekanden: 0 });
  }

  // Gruppera per förfrågan — ett mejl per kund och förfrågan, inte per bolag.
  const perForfragan = new Map();
  for (const n of nekanden) {
    if (!perForfragan.has(n.inquiry_id)) perForfragan.set(n.inquiry_id, []);
    perForfragan.get(n.inquiry_id).push(n);
  }

  const forfragningar = [...perForfragan.entries()].slice(0, MAX_PER_KORNING);

  let skickade = 0;
  let rapporterade = 0;
  const problem = [];

  for (const [inquiryId, rader] of forfragningar) {
    const { data: inquiry } = await admin
      .from("inquiries")
      .select("requester_name, requester_email, search_role, city")
      .eq("id", inquiryId)
      .maybeSingle();

    // Helheten kunden behöver: hur gick det för förfrågan i stort? Räknas om
    // vid varje körning, så siffran stämmer även när svar kommit emellan.
    const { data: allaMottagare } = await admin
      .from("inquiry_recipients")
      .select("status")
      .eq("inquiry_id", inquiryId);

    const accepterade = (allaMottagare ?? []).filter((r) => r.status === "accepted").length;
    const vantande = (allaMottagare ?? []).filter((r) => r.status === "pending").length;

    if (!inquiry?.requester_email) {
      // Utan adress finns ingen att berätta för. Raderna märks ändå som
      // rapporterade, annars försöker jobbet om dem varje natt för alltid.
      problem.push(`Förfrågan ${inquiryId} saknar mejladress.`);
    } else {
      const resultat = await sendDeclineSummaryToRequester({
        to: inquiry.requester_email,
        requesterName: fornamn(inquiry.requester_name),
        nekande: rader.map((r) => ({
          companyName: r.companies?.name || "Ett bolag",
          message: r.response_message || null,
        })),
        kvarVantande: vantande,
        antalAccepterade: accepterade,
        searchRole: inquiry.search_role,
        city: inquiry.city,
      });

      // Misslyckas mejlet lämnas raderna orapporterade, så nästa körning
      // försöker igen. Hellre ett besked som dröjer ett dygn än inget alls.
      if (resultat === null) {
        problem.push(`Mejlet för förfrågan ${inquiryId} gick inte att skicka — försöker igen i natt.`);
        continue;
      }
      skickade++;
    }

    const { error: markFel } = await admin
      .from("inquiry_recipients")
      .update({ decline_reported_at: new Date().toISOString() })
      .in(
        "id",
        rader.map((r) => r.id)
      );

    if (markFel) {
      console.error("Kunde inte märka nekandena som rapporterade:", JSON.stringify(markFel));
      problem.push(`Förfrågan ${inquiryId}: beskedet gick ut men raderna är inte märkta — kan upprepas.`);
    } else {
      rapporterade += rader.length;
    }
  }

  if (problem.length) console.warn(`Nekandesammanställningen: ${problem.join(" ")}`);

  return NextResponse.json({
    sammanstallningar: skickade,
    nekanden: rapporterade,
    kvar: perForfragan.size - forfragningar.length,
    problem,
  });
}
