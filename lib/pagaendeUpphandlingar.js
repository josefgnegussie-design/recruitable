// Pågående upphandlingar som teaser på /upphandling: att det faktiskt händer
// något här. ENDAST SERVERSIDAN — läser inquiries med service role.
//
// Varje upphandling blir en mening byggd enbart ur fasta val: tjänst,
// yrkesområden, län, tidplan och hur många bolag som bjudits in. Köparens egna
// fritexter (rubrik, beskrivning, "Beskriv er verksamhet") används aldrig: de kan
// avslöja köparen, och det är just namnet som ska locka bolagen att tacka ja.
// Kommunen byts mot länet av samma skäl: industri i en liten kommun kan peka ut
// en enda arbetsgivare.
//
// Bara inbjudningar där köparen sagt ja till att visas (visaSomExempel), som
// Recruitable godkänt och vars svarsdatum inte passerat.

import { regionForCity } from "@/lib/helpers";
import { idag } from "@/lib/upphandling";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX = 6;
const DAGAR = 90;

const MANADER = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

// "a, b och c". Yrkesområdena har själva "och" och kommatecken i namnen
// ("lager, logistik och transport"), så de binds ihop med "samt" i stället.
function lista(ord, bindeord = "och") {
  if (ord.length <= 1) return ord.join("");
  const sep = bindeord === "samt" ? "; " : ", ";
  return `${ord.slice(0, -1).join(sep)} ${bindeord} ${ord.at(-1)}`;
}

function manad(iso) {
  const [ar, m] = iso.split("-").map(Number);
  return `${MANADER[m - 1]} ${ar}`;
}

// En mening om upphandlingen, till exempel "Bemanning inom industri och
// tillverkning i Västra Götalands län, med start i januari 2027."
export function sammanfattning(rad, u) {
  const lan = [...new Set((u.orter ?? [rad.city]).map(regionForCity).filter(Boolean))];
  const omraden = (u.omraden ?? []).map((o) => o.toLowerCase());
  const delar = [
    rad.service || "Bemanning eller rekrytering",
    omraden.length ? ` inom ${lista(omraden, "samt")}` : "",
    lan.length ? ` i ${lista(lan)}` : "",
    u.startdatum ? `, med start i ${manad(u.startdatum)}` : "",
  ];
  return `${delar.join("")}.`;
}

export async function hamtaPagaendeUpphandlingar() {
  try {
    const sedan = new Date(Date.now() - DAGAR * 864e5).toISOString();
    const { data, error } = await createAdminClient()
      .from("inquiries")
      .select("id, created_at, service, city, upphandling, inquiry_recipients(count)")
      .eq("moderation_status", "approved")
      .not("upphandling", "is", null)
      .gte("created_at", sedan)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;

    const dag = idag();
    return (data ?? [])
      .filter((r) => r.upphandling?.visaSomExempel === true)
      .filter((r) => !r.upphandling.svaraSenast || r.upphandling.svaraSenast >= dag)
      .slice(0, MAX)
      .map((r) => ({
        mening: sammanfattning(r, r.upphandling),
        inbjudna: r.inquiry_recipients?.[0]?.count ?? 0,
        svaraSenast: r.upphandling.svaraSenast ?? null,
      }));
  } catch (err) {
    // Saknas kolumnen eller nätet: sidan visas utan avsnittet.
    console.error("Kunde inte läsa pågående upphandlingar:", err.message);
    return [];
  }
}
