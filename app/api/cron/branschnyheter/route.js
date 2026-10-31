import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaBranschnyheter } from "@/lib/branschnyheter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hämtar dygnets branschnyheter till startsidans "Från branschen". Körs av
// Vercel Cron, se vercel.json. Startsidan läser tabellen och uppdateras inom
// fem minuter utan deploy.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET saknas — nyhetsjobbet vägrar köra oskyddat.");
    return NextResponse.json({ error: "Saknar konfiguration." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  const { nyheter, lasta, problem } = await hamtaBranschnyheter();

  if (problem.length) console.warn(`Branschnyheterna: ${problem.join(" ")}`);

  let nya = 0;
  if (nyheter.length) {
    // ignoreDuplicates: en rad som redan finns ska inte skrivas över, annars
    // skulle en nyhet som dolts för hand kunna påverkas av nästa körning.
    const { data, error } = await createAdminClient()
      .from("branschnyheter")
      .upsert(nyheter, { onConflict: "titel_nyckel", ignoreDuplicates: true })
      .select("id");

    if (error) {
      console.error("Kunde inte spara branschnyheterna:", JSON.stringify(error));
      return NextResponse.json(
        { error: "Kunde inte spara nyheterna. Är supabase/migration_branschnyheter.sql körd?" },
        { status: 500 }
      );
    }
    nya = data?.length ?? 0;
  }

  return NextResponse.json({ lasta, relevanta: nyheter.length, nya, problem });
}
