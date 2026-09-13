import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { SKAL, hamtaSammanslagningsbolag, hinderFor, slaSammanAdresser } from "@/lib/sammanslagning";
import SammanslagningsKo from "@/components/admin/SammanslagningsKo";
import AvregistreradeKo from "@/components/admin/AvregistreradeKo";

export const dynamic = "force-dynamic";

// Domänen ur en webbplatsadress, för jämförelsen mellan de två bolagen.
function doman(url) {
  return (url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

// Recruitables kö för begärda sammanslagningar.
//
// Det här är det enda stället där ett bolag kan försvinna ur registret, och det
// som avgör beslutet går inte att slå upp maskinellt: Bolagsverkets värdefulla
// datamängder ger inte ägarstruktur. Kön visar därför det som ändå går att
// kontrollera — delad webbplatsdomän, vem som begärt det, vad som går förlorat
// och vad som flyttas — så att bedömningen görs på underlag och inte på tilltro
// till den som skickade begäran.
export default async function SammanslagningarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/logga-in");
  if (!isPlatformAdmin(user.email)) redirect("/");

  const admin = createAdminClient();

  const { data: arenden, error } = await admin
    .from("merge_requests")
    .select("id, created_at, company_id, survivor_id, requested_by, reason, effective_date, message")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="admin-sida">
        <h1 className="admin-h1">Sammanslagningar</h1>
        <div className="admin-panel">
          <p style={{ margin: 0 }}>
            Kön kunde inte läsas. Är <code>supabase/migration_sammanslagning.sql</code> körd?
          </p>
        </div>
      </div>
    );
  }

  const bolag = await hamtaSammanslagningsbolag(
    admin,
    (arenden ?? []).flatMap((a) => [a.company_id, a.survivor_id])
  );

  // Mejladresserna bor i auth.users och inte i company_admins. Kön är alltid
  // kort, så ett uppslag per administratör kostar ingenting — och utan dem kan
  // granskaren inte se vem som begärt att ett bolag ska försvinna.
  const epostCache = new Map();
  async function epostFor(userId) {
    if (!userId) return null;
    if (!epostCache.has(userId)) {
      const { data } = await admin.auth.admin.getUserById(userId);
      epostCache.set(userId, data?.user?.email ?? null);
    }
    return epostCache.get(userId);
  }

  const berikade = await Promise.all(
    (arenden ?? []).map(async (a) => {
      const upphorande = bolag[a.company_id];
      const overlevande = bolag[a.survivor_id];

      const sokande = await epostFor(a.requested_by);
      const sokandeDoman = (sokande || "").split("@")[1]?.toLowerCase() || null;

      const administratorer = await Promise.all(
        (upphorande?.administratorer ?? []).map(async (adm) => ({
          id: adm.id,
          arAgare: adm.ar_agare,
          epost: await epostFor(adm.user_id),
        }))
      );

      const arv =
        upphorande && overlevande ? slaSammanAdresser(overlevande, upphorande) : { tillagda: [] };

      return {
        id: a.id,
        skapat: a.created_at,
        skal: a.reason,
        skalText: SKAL[a.reason] ?? a.reason,
        datum: a.effective_date,
        meddelande: a.message,
        sokande,
        upphorande: upphorande
          ? {
              id: upphorande.id,
              name: upphorande.name,
              city: upphorande.city,
              orgNumber: upphorande.org_number,
              claimed: upphorande.claimed,
              kontor: upphorande.kontor.map((k) => ({ city: k.city, paid: k.paid })),
              antalForfragningar: upphorande.antalForfragningar,
              administratorer,
            }
          : null,
        overlevande: overlevande
          ? {
              id: overlevande.id,
              name: overlevande.name,
              city: overlevande.city,
              orgNumber: overlevande.org_number,
              claimed: overlevande.claimed,
              antalAdmins: overlevande.administratorer.length,
            }
          : null,
        // Delad webbplatsdomän är den enda maskinella signalen vi har på att två
        // bolag hör ihop. Syskonbolag i en koncern delar den nästan alltid, och
        // en konkurrent gör det aldrig. Den bevisar ingenting på egen hand — men
        // saknas den finns det ingenting alls som talar för begäran.
        domanMatchar: Boolean(
          upphorande?.link &&
            overlevande?.link &&
            doman(upphorande.link) &&
            doman(upphorande.link) === doman(overlevande.link)
        ),
        sokandeDomanMatchar: Boolean(
          sokandeDoman && overlevande?.link && doman(overlevande.link) === sokandeDoman
        ),
        arvdaOrter: arv.tillagda.map((adress) => adress.city),
        hinder: hinderFor(upphorande),
      };
    })
  );

  // Avregistrerade bolag som ingen tagit ställning till. Registerkontrollen mot
  // Bolagsverket (/api/cron/bolagsverket-koll) skriver bara ner uppgiften — vad
  // som ska hända med kortet avgörs här.
  const { data: avregistrerade } = await admin
    .from("companies")
    .select("id, name, city, org_number, claimed, deregistered_at, bolagsverket_active")
    .not("deregistered_at", "is", null)
    .is("retired_at", null)
    .is("deregistration_handled_at", null)
    .order("deregistered_at", { ascending: false })
    .limit(50);

  const avregBolag = await hamtaSammanslagningsbolag(
    admin,
    (avregistrerade ?? []).map((b) => b.id)
  );

  const avregBerikade = (avregistrerade ?? []).map((b) => {
    const fullt = avregBolag[b.id];
    return {
      id: b.id,
      name: b.name,
      city: b.city,
      orgNumber: b.org_number,
      claimed: b.claimed,
      deregisteredAt: b.deregistered_at,
      ejVerksamt: b.bolagsverket_active === false,
      antalAdmins: fullt?.administratorer.length ?? 0,
      antalKontor: fullt?.kontor.length ?? 0,
      antalForfragningar: fullt?.antalForfragningar ?? 0,
      hinder: hinderFor(fullt),
    };
  });

  return (
    <div className="admin-sida">
      <h1 className="admin-h1">Sammanslagningar</h1>
      <p className="admin-ingress">
        Bolag som begärt att två kort ska bli ett. Ett godkännande gör det ena osynligt i sökningen och
        låter dess adress leda vidare till det andra — raden raderas aldrig, så beslutet går att ta
        tillbaka.
      </p>
      <SammanslagningsKo arenden={berikade} />

      <section className="admin-block">
        <h2 className="admin-h2">Avregistrerade bolag</h2>
        <p className="admin-ingress">
          Hittade av den nattliga kontrollen mot Bolagsverket. Bolagen visas fortfarande i sökningen —
          en avregistrering säger att bolaget upphört, inte vart verksamheten tog vägen, och den
          skillnaden avgör om kortet ska peka vidare eller bara sluta visas.
        </p>
        <AvregistreradeKo bolag={avregBerikade} />
      </section>
    </div>
  );
}
