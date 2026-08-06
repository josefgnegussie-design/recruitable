export const INQUIRIES_PAGE_SIZE = 50;

// Kontaktuppgifter (namn, e-post, roll) skickas medvetet inte till klienten
// förrän bolaget accepterat förfrågan — bara företagsnamn och ort syns
// innan dess. Låses upp via /api/mina-sidor/forfragan-detaljer efter accept.
// Att förfrågan överhuvudtaget syns här förutsätter redan att Recruitable
// godkänt den (se moderation_status i RLS-policyerna) — bolag ser aldrig
// omodererade förfrågningar. Delad mellan den initiala SSR-sidan och
// API-routen som hämtar fler sidor, så redigeringslogiken aldrig kan
// glömmas bort på ena stället.
export function mapInquiryRow(row) {
  const unlocked = row.status === "accepted";
  const inq = row.inquiries;
  return {
    recipientId: row.id,
    receivedAt: row.created_at,
    status: row.status,
    description: inq.description,
    search_role: inq.search_role,
    focus_area: inq.focus_area,
    service: inq.service,
    requester_company: inq.requester_company,
    requester_city: inq.requester_city,
    requester_name: unlocked ? inq.requester_name : null,
    requester_email: unlocked ? inq.requester_email : null,
    requester_role: unlocked ? inq.requester_role : null,
  };
}
