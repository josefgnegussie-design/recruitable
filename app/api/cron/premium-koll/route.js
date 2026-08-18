import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPremiumAlertToAdmins } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = "https://recruitable.se";

// Varje kontroll är en HTTP-hämtning av en publik sida. Taket finns för att
// jobbet ska hålla sig inom Vercels tidsgräns även när registret växer.
const MAX_PROFILE_CHECKS = 25;

// Klassnamnet som bara renderas när isPremium är sant (se app/bolag/[id]/page.js).
const PREMIUM_MARKER = "premium-section";

const CONTENT_FIELDS = ["cover_image", "extended_vision", "mission", "history", "expertise"];

function hasContent(company) {
  const text = CONTENT_FIELDS.some((f) => typeof company[f] === "string" && company[f].trim());
  const team = Array.isArray(company.team_members) && company.team_members.length > 0;
  return text || team;
}

// Bevakar att bolag som betalar för premium faktiskt har sin utökade profil
// synlig för besökare. Loggrader räcker inte — ingen läser dem förrän kunden
// hör av sig. Körs av Vercel Cron, se vercel.json.
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
      .select("id, name, premium_until, cover_image, extended_vision, mission, history, expertise, team_members")
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

    if (!hasContent(company)) {
      problems.push({ company: label, issue: "Betalar för premium men har inget innehåll i den utökade profilen." });
    }
  }

  // Det som faktiskt räknas: syns avsnittet för en besökare? Fångar fel som
  // databasen inte känner till — trasig rendering, cachad nedgradering.
  for (const company of companies.slice(0, MAX_PROFILE_CHECKS)) {
    const label = `${company.name} (id ${company.id})`;
    const url = `${SITE}/bolag/${company.id}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        problems.push({ company: label, issue: `Profilsidan svarar ${res.status}.` });
        continue;
      }
      const html = await res.text();
      if (!html.includes(PREMIUM_MARKER)) {
        problems.push({ company: label, issue: "Profilsidan visar inte det utökade avsnittet." });
      }
    } catch (err) {
      problems.push({ company: label, issue: `Profilsidan gick inte att hämta: ${err.message}` });
    }
  }

  if (problems.length) {
    console.error(`Premiumkontrollen hittade ${problems.length} problem.`);
    await sendPremiumAlertToAdmins({ problems });
  }

  return NextResponse.json({
    kontrollerade: companies.length,
    sidkontroller: Math.min(companies.length, MAX_PROFILE_CHECKS),
    problem: problems,
  });
}
