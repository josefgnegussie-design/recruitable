import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { hamtaAdministratorer, kravBolagsadmin } from "@/lib/bolagsadmin";
import { sendAgarskapFlyttat } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lämnar över ägarskapet till en annan administratör i samma bolag.
//
// Ägaren svarar för prenumerationen och är den enda som får lägga till eller ta
// bort administratörer. Den som registrerade bolaget blir ägare, men ansvaret
// ska kunna flyttas — den som en gång skrev in sin adress slutar, byter roll
// eller ska helt enkelt inte vara den som håller i abonnemanget.
export async function POST(request) {
  const limited = await rateLimit(request, "konto-overlat", 10, 3600);
  if (limited) return limited;

  const { fel, admin, rad, user } = await kravBolagsadmin({ kravAgare: true });
  if (fel) return fel;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { adminId } = body;
  if (typeof adminId !== "string" || !adminId) {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }
  if (adminId === rad.id) {
    return NextResponse.json({ error: "Du är redan ägare." }, { status: 400 });
  }

  const { data: mottagare } = await admin
    .from("company_admins")
    .select("id, company_id, user_id, verified")
    .eq("id", adminId)
    .maybeSingle();

  if (!mottagare || mottagare.company_id !== rad.company_id || !mottagare.verified) {
    return NextResponse.json({ error: "Hittades inte." }, { status: 404 });
  }

  // Ägaren släpps före mottagaren tar över. Databasen tillåter bara en ägare per
  // bolag, så gjordes det i andra ordningen skulle det unika indexet stoppa
  // skrivningen och bolaget stå kvar med den gamla ägaren.
  const { error: slappFel } = await admin
    .from("company_admins")
    .update({ ar_agare: false })
    .eq("id", rad.id);

  if (slappFel) {
    console.error("Kunde inte släppa ägarskapet:", JSON.stringify(slappFel));
    return NextResponse.json({ error: "Kunde inte lämna över. Försök igen." }, { status: 500 });
  }

  const { error: taFel } = await admin
    .from("company_admins")
    .update({ ar_agare: true })
    .eq("id", adminId);

  if (taFel) {
    // Misslyckas andra steget står bolaget utan ägare, vilket är värre än att
    // överlåtelsen inte blev av. Den gamla ägaren sätts tillbaka.
    await admin.from("company_admins").update({ ar_agare: true }).eq("id", rad.id);
    console.error("Kunde inte flytta ägarskapet, återställde:", JSON.stringify(taFel));
    return NextResponse.json({ error: "Kunde inte lämna över. Försök igen." }, { status: 500 });
  }

  const { data: bolag } = await admin
    .from("companies")
    .select("name")
    .eq("id", rad.company_id)
    .maybeSingle();

  // Båda parter ska få veta. Den som lämnat ifrån sig ansvaret ska kunna
  // upptäcka det om det inte var meningen, och den som tagit över ska veta att
  // prenumerationen nu ligger hos dem.
  const [gammal, ny] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.auth.admin.getUserById(mottagare.user_id),
  ]);

  await Promise.allSettled(
    [gammal?.data?.user?.email, ny?.data?.user?.email].filter(Boolean).map((to) =>
      sendAgarskapFlyttat({
        to,
        companyName: bolag?.name || "ert bolag",
        franEpost: gammal?.data?.user?.email || "okänd",
        tillEpost: ny?.data?.user?.email || "okänd",
      })
    )
  );

  return NextResponse.json({
    administratorer: await hamtaAdministratorer(admin, rad.company_id),
    duArAgare: false,
  });
}
