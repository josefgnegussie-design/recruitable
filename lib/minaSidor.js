import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { INQUIRIES_PAGE_SIZE, mapInquiryRow } from "@/lib/inquiries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vem som tittar på Mina sidor och om kontot får se något där. Delad av alla
// flikar, som numera är egna sidor med egna adresser.
//
// Kontrollen görs i varje sida och inte i en gemensam layout: en layout
// renderas inte om vid navigering mellan flikarna, så en behörighet som bara
// avgjorts där gäller inte för nästa sida. cache() gör att samma begäran ändå
// bara frågar Supabase en gång, hur många komponenter som än anropar.
//
// Returnerar { tillstand } när kontot inte är redo (väntar på granskning,
// saknar bolag), annars { supabase, user, adminRow }.
export const hamtaBolagskonto = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middlewaren skickar redan den utloggade till inloggningen med ?next=, men
  // sidan får inte lita på att den kört.
  if (!user) redirect("/logga-in");

  // Recruitables egna konton har inget bolag att administrera och landade
  // förut på "Vi hittar ingen bolagskoppling för det här kontot". Inloggningen
  // skickar alla hit, så omdirigeringen hör hemma här och inte i formuläret —
  // då gäller den oavsett vilken väg man kom in.
  if (isPlatformAdmin(user.email)) redirect("/admin");

  const { data: adminRow } = await supabase
    .from("company_admins")
    .select("company_id, verified, ar_agare")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) return { tillstand: "saknas", user };
  if (!adminRow.verified) return { tillstand: "granskas", user, adminRow };
  if (!adminRow.company_id) return { tillstand: "okopplad", user, adminRow };

  return { supabase, user, adminRow };
});

// Det flikraden behöver oavsett vilken flik som visas: hur många förfrågningar
// som väntar på svar och hur många kontor bolaget har. Bägge är räkningar
// (head: true) och hämtar inga rader.
//
// Obesvarade räknas i databasen och inte ur den inlästa listan. Listan är bara
// första sidan, och på profil- och kontorsfliken läses den inte alls.
export async function hamtaFlikraknare(supabase, companyId) {
  const [{ count: obesvarade }, { count: antalKontor }] = await Promise.all([
    // Service role av samma skäl som listan nedan, och med samma modereringsgrind.
    createAdminClient()
      .from("inquiry_recipients")
      .select("id, inquiries!inner(moderation_status)", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending")
      .eq("inquiries.moderation_status", "approved"),
    supabase.from("offices").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);

  return { obesvarade: obesvarade ?? 0, antalKontor: antalKontor ?? 0 };
}

// Första sidan av bolagets förfrågningar.
//
// Hämtar bara de senaste INQUIRIES_PAGE_SIZE — fler sidor laddas vid behov via
// /api/mina-sidor/forfragan-lista. Annars skulle ett bolag med många
// förfrågningar över tid göra sidan tyngre och tyngre.
//
// Läses med service role och inte med besökarens session: bolagen har inte
// längre select på inquiries (migration_forfragan_sekretess.sql), eftersom den
// policyn gav dem hela raden — inklusive kundens namn och mejl — innan de
// accepterat och betalat för leaden. Behörigheten är redan avgjord av
// hamtaBolagskonto: adminRow är verifierad och company_id styr vilka rader som
// hämtas.
export async function hamtaForfragningar(companyId) {
  const { data: inquiryRows } = await createAdminClient()
    .from("inquiry_recipients")
    .select("id, created_at, status, inquiries!inner(*)")
    .eq("company_id", companyId)
    // Modereringsgrinden. Den satt i RLS-policyn på inquiry_recipients, som slog
    // upp inquiries.moderation_status — men servicerollen går förbi RLS, och
    // mottagarraderna skapas redan när förfrågan skickas in. Utan filtret här
    // skulle bolagen se förfrågningar du ännu inte granskat.
    .eq("inquiries.moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(INQUIRIES_PAGE_SIZE + 1);

  const rows = inquiryRows || [];
  return {
    hasMore: rows.length > INQUIRIES_PAGE_SIZE,
    inquiries: rows
      .slice(0, INQUIRIES_PAGE_SIZE)
      .filter((row) => row.inquiries)
      .map(mapInquiryRow),
  };
}

// En enskild förfrågan, för länkarna i mejlen. Null om den inte finns, inte är
// granskad eller hör till ett annat bolag — sidan svarar då 404 i alla tre
// fallen, så att adressen inte avslöjar att ett id finns hos någon annan.
export async function hamtaForfragan(companyId, recipientId) {
  if (typeof recipientId !== "string" || !UUID_RE.test(recipientId)) return null;

  const { data: row } = await createAdminClient()
    .from("inquiry_recipients")
    .select("id, created_at, status, inquiries!inner(*)")
    .eq("id", recipientId)
    .eq("company_id", companyId)
    .eq("inquiries.moderation_status", "approved")
    .maybeSingle();

  return row?.inquiries ? mapInquiryRow(row) : null;
}
