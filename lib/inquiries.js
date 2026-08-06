export const INQUIRIES_PAGE_SIZE = 50;

// Kontaktuppgifter (namn, e-post, roll) skickas medvetet inte till klienten
// förrän bolaget accepterat förfrågan OCH Recruitable manuellt släppt dem via
// /admin/forfragningar — bara företagsnamn och ort syns innan dess. Slutlig
// upplåsning sker via /api/mina-sidor/forfragan-detaljer. Delad mellan den
// initiala SSR-sidan och API-routen som hämtar fler sidor, så redigerings-
// logiken aldrig kan glömmas bort på ena stället.
export function mapInquiryRow(row) {
  const unlocked = row.status === "accepted" && Boolean(row.released_at);
  const inq = row.inquiries;
  return {
    recipientId: row.id,
    receivedAt: row.created_at,
    status: row.status,
    released: Boolean(row.released_at),
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
