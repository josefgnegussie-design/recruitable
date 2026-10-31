import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rateLimit";
import { bolagsdoman, hinderForOvertagande } from "@/lib/overtagande";
import { bolagMedOrgnr } from "@/lib/overtagandeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Finns bolaget i registret, och kan det tas över? Ger formuläret besked redan i
// första steget. Inget här är hemligt: allt står på den publika profilen.
export async function GET(request) {
  const limited = await rateLimit(request, "registerstatus", 40, 3600);
  if (limited) return limited;

  const orgnr = new URL(request.url).searchParams.get("orgnr");
  const bolag = await bolagMedOrgnr(createAdminClient(), orgnr);
  if (!bolag) return NextResponse.json({ finns: false });

  return NextResponse.json({
    finns: true,
    slug: bolag.slug,
    namn: bolag.name,
    doman: bolagsdoman(bolag.link),
    hinder: hinderForOvertagande(bolag)?.text ?? null,
  });
}
