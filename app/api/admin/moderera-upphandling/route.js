import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { resolveCompanyContacts } from "@/lib/offices";
import { UUID_RE } from "@/lib/upphandlingRepo";
import { sendUpphandlingBeslut, sendUpphandlingTillBolag } from "@/lib/emailUpphandling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BESLUT = new Set(["approved", "rejected"]);

// Ett tak mot att en för bred upphandling blir ett massutskick från den domän
// förfrågningsmejlen går ut från.
const MAX_MOTTAGARE = 300;

// Recruitables granskning. Godkännandet publicerar upphandlingen och mejlar de
// bolag som tagit över sin profil och har ett matchande yrkesområde.
export async function POST(request) {
  const limited = await rateLimit(request, "admin-moderera-upphandling", 60, 3600);
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

  const { id, beslut } = body;
  if (typeof id !== "string" || !UUID_RE.test(id) || !BESLUT.has(beslut)) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Villkoret på status gör att två granskare inte båda kan skicka ut samma mejl.
  const { data: u, error } = await admin
    .from("procurements")
    .update({ moderation_status: beslut, moderated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("moderation_status", "pending")
    .select(
      "id, title, description, service, cities, focus_areas, interest_deadline, buyer_description, " +
        "name_visibility, requester_company, requester_email"
    )
    .maybeSingle();

  if (error) {
    console.error("Kunde inte spara beslutet:", JSON.stringify(error));
    return NextResponse.json({ error: "Kunde inte spara beslutet." }, { status: 500 });
  }
  if (!u) return NextResponse.json({ error: "Upphandlingen är redan hanterad." }, { status: 400 });

  const godkand = beslut === "approved";
  let mottagare = [];

  if (godkand) {
    const { data: bolag, error: bolagsfel } = await admin
      .from("companies")
      .select("id, name, contact")
      .eq("claimed", true)
      .is("retired_at", null)
      .overlaps("focus", u.focus_areas)
      .limit(MAX_MOTTAGARE);

    if (bolagsfel) console.error("Kunde inte slå upp matchande bolag:", JSON.stringify(bolagsfel));

    const kontakter = await resolveCompanyContacts(bolag || [], u.cities);
    mottagare = [...new Map(kontakter.map((m) => [m.email.toLowerCase(), m])).values()];
  }

  const forMejl = { ...u, kopare_namn: u.name_visibility === "direkt" ? u.requester_company : null };

  after(async () => {
    const utfall = await Promise.allSettled([
      sendUpphandlingBeslut({ till: u.requester_email, titel: u.title, godkand, id: u.id }),
      ...mottagare.map((m) => sendUpphandlingTillBolag({ till: m.email, u: forMejl })),
    ]);
    const fel = utfall.filter((r) => r.status === "rejected").length;
    if (fel) console.error(`Upphandling ${u.id}: ${fel} mejl gick inte ut.`);
  });

  return NextResponse.json({ ok: true, mejlade: mottagare.length });
}
