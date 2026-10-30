import { randomBytes } from "node:crypto";
import { hashaToken, rimligToken } from "@/lib/inbjudningar";
import { fornamn } from "@/lib/inquiries";

// Uppföljningssidan för beställaren, /forfragan/<token>. Se
// supabase/migration_uppfoljning.sql.
//
// Beställarna har inga konton, så länken är det enda som visar att man har
// rätt att se förfrågan. Den har samma form som inbjudningarnas: 32 slumpade
// byte i base64url, och bara SHA-256-hashen i databasen.
//
// Vill vi senare ge beställarna konton räcker det att koppla
// inquiries.requester_email till kontots adress och visa samma vy, byggd av
// hamtaUppfoljning, för alla förfrågningar med den adressen. Länken kan leva
// kvar bredvid, för den som inte vill logga in.
export function nyUppfoljningstoken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashaToken(token) };
}

export function uppfoljningsSokvag(token) {
  return `/forfragan/${token}`;
}

// Det beställaren ser för varje mottagande bolag. Granskningen gäller hela
// förfrågan, så tills Recruitable godkänt den väntar alla bolag på den — även
// de rader som redan finns i inquiry_recipients.
function statusFor(moderationStatus, mottagarStatus) {
  if (moderationStatus === "rejected") return "stoppad";
  if (moderationStatus !== "approved") return "granskas";
  if (mottagarStatus === "accepted") return "intresserad";
  if (mottagarStatus === "declined") return "tackat-nej";
  return "vantar";
}

// Svar först, så att det beställaren kan agera på hamnar överst. Inom varje
// grupp i bokstavsordning, så att listan står still mellan besöken.
const ORDNING = { intresserad: 0, "tackat-nej": 1, vantar: 2, granskas: 3, stoppad: 4 };

// Förfrågan bakom en token, eller null om token är felaktig. Sidan svarar 404
// för null, oavsett om token var felformad eller bara okänd.
//
// Hämtar bara det sidan visar: behovet, förnamnet för tilltalet och bolagens
// svar. Kontaktuppgifterna står redan i beställarens eget mejl, och länken kan
// ha vidarebefordrats till en kollega.
export async function hamtaUppfoljning(admin, token) {
  if (!rimligToken(token)) return null;

  const { data } = await admin
    .from("inquiries")
    .select(
      "id, created_at, moderation_status, description, search_role, focus_area, service, city, requester_name, " +
        "inquiry_recipients(id, status, responded_at, response_message, companies(id, name, slug))"
    )
    .eq("uppfoljning_token_hash", hashaToken(token))
    .maybeSingle();

  if (!data) return null;

  const bolag = (data.inquiry_recipients || [])
    .filter((r) => r.companies)
    .map((r) => {
      const status = statusFor(data.moderation_status, r.status);
      const harSvarat = status === "intresserad" || status === "tackat-nej";
      return {
        id: r.id,
        namn: r.companies.name,
        profil: `/bolag/${r.companies.slug || r.companies.id}`,
        status,
        besvarad: harSvarat ? r.responded_at : null,
        meddelande: harSvarat ? r.response_message || null : null,
      };
    })
    .sort((a, b) => ORDNING[a.status] - ORDNING[b.status] || a.namn.localeCompare(b.namn, "sv"));

  return {
    skickad: data.created_at,
    granskning: data.moderation_status,
    beskrivning: data.description,
    taggar: [data.search_role, data.focus_area, data.service, data.city].filter(Boolean),
    fornamn: fornamn(data.requester_name),
    bolag,
  };
}
