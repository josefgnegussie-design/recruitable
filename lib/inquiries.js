export const INQUIRIES_PAGE_SIZE = 50;

// Förnamnet ur ett fullständigt namn. Räcker för att skriva "Anna söker en
// lagerchef" utan att lämna ut vem Anna är.
export function fornamn(heltNamn) {
  return String(heltNamn || "").trim().split(/\s+/)[0] || "";
}

// Vad ett bolag får se av en förfrågan innan de accepterat den.
//
// Betalningen är knuten till leaden, inte till profilen. Allt som räcker för att
// hitta kunden på egen hand är därför låst tills förfrågan accepterats — annars
// läser bolaget förfrågan, slår upp kunden och ringer förbi oss, och vi har gett
// bort det enda vi tar betalt för.
//
// Kundens BOLAGSNAMN och ORT var det som läckte, och ett bolagsnamn är i
// praktiken hela kontaktuppgiften. Kvar syns behovet — vad de söker och var
// uppdraget ligger — plus förnamn och roll, så att bolaget kan bedöma om leaden
// är värd något innan de betalar för den.
//
// Uppdragets ort (inq.city/region) är INTE kundens ort: den säger var arbetet
// ska utföras och är en del av behovet. Utan den kan ett Malmöbolag inte avgöra
// om uppdraget ligger i Kiruna, och accepterar i blindo.
//
// Att förfrågan överhuvudtaget syns förutsätter redan att Recruitable godkänt
// den (moderation_status i RLS-policyerna) — bolag ser aldrig omodererade
// förfrågningar. Delad mellan den initiala SSR-sidan och API-routen som hämtar
// fler sidor, så redigeringen aldrig kan glömmas bort på ena stället.
export function mapInquiryRow(row) {
  const unlocked = row.status === "accepted";
  const inq = row.inquiries;
  return {
    recipientId: row.id,
    receivedAt: row.created_at,
    status: row.status,

    // Behovet — syns alltid.
    description: inq.description,
    search_role: inq.search_role,
    focus_area: inq.focus_area,
    service: inq.service,
    city: inq.city,
    region: inq.region,

    // Vem som frågar, så mycket som går utan att peka ut dem.
    requester_first_name: fornamn(inq.requester_name),
    requester_role: inq.requester_role,

    // Låst till efter accept. Null och inte utelämnat, så att klienten kan
    // skilja "inte upplåst" från "fanns inte".
    requester_company: unlocked ? inq.requester_company : null,
    requester_city: unlocked ? inq.requester_city : null,
    requester_name: unlocked ? inq.requester_name : null,
    requester_email: unlocked ? inq.requester_email : null,
    requester_phone: unlocked ? inq.requester_phone : null,
    requester_website: unlocked ? inq.requester_website : null,
  };
}
