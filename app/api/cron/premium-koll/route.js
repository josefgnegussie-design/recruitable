import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPremiumAlertToAdmins } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bevakar att ingen står kvar som betalande efter att perioden löpt ut —
// typiskt att ett avslutsevent från Stripe missats. Loggrader räcker inte,
// ingen läser dem förrän kunden hör av sig. Körs av Vercel Cron, se vercel.json.
//
// Kontrollen gjorde tidigare två saker till: den varnade för premiumbolag utan
// innehåll i den utökade profilen, och hämtade varje profilsida för att se att
// avsnittet faktiskt renderades. Den utökade profilen finns inte längre —
// omslagsbild, mission, historia, erfarenhet och medarbetare är borttagna — så
// båda kontrollerna hade inget kvar att kontrollera. Kvar står den som handlar
// om pengar.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET saknas — premiumkontrollen vägrar köra oskyddad.");
    return NextResponse.json({ error: "Saknar konfiguration." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  // Att kontrollen själv fallerar är i sig något att larma om — annars blir
  // tystnaden från jobbet omöjlig att skilja från "allt är bra".
  let companies;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("companies")
      .select("id, name, premium_until")
      .eq("is_premium", true);
    if (error) throw new Error(error.message);
    companies = data ?? [];
  } catch (err) {
    console.error("Premiumkontrollen kunde inte läsa bolagen:", err.message);
    await sendPremiumAlertToAdmins({
      problems: [{ company: "—", issue: `Kontrollen kunde inte läsa companies: ${err.message}` }],
    });
    return NextResponse.json({ error: "Kunde inte läsa bolagen." }, { status: 500 });
  }

  const problems = [];
  const now = Date.now();

  for (const company of companies) {
    const label = `${company.name} (id ${company.id})`;

    if (!company.premium_until) {
      problems.push({ company: label, issue: "Saknar premium_until — ingen period att stämma av mot." });
    } else if (new Date(company.premium_until).getTime() < now) {
      problems.push({
        company: label,
        issue: `Betald period gick ut ${company.premium_until.slice(0, 10)} men premium är kvar — ett avslutsevent från Stripe kan ha missats.`,
      });
    }
  }

  if (problems.length) {
    console.error(`Premiumkontrollen hittade ${problems.length} problem.`);
    await sendPremiumAlertToAdmins({ problems });
  }

  return NextResponse.json({ kontrollerade: companies.length, problem: problems });
}
