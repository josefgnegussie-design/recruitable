// Sökning i registret på namn eller organisationsnummer.
//
// Låg här tidigare i /api/admin/bolag-sok. Den flyttades ut när bolagen själva
// fick begära en sammanslagning: också de måste kunna peka ut ett bolag i
// registret, och två kopior av uppslaget hade förr eller senare tolkat ett
// organisationsnummer med bindestreck olika. Behörigheten ligger kvar i
// respektive route — den här funktionen frågar inte vem som söker.

const KOLUMNER = "id, name, org_number, city, address, claimed";

export async function sokBolag(admin, fraga, { antal = 10 } = {}) {
  const text = String(fraga || "").trim().slice(0, 120);
  if (text.length < 2) return { traffar: [] };

  const siffror = text.replace(/\D/g, "");

  const kor = (kolumner) => {
    let sokning = admin.from("companies").select(kolumner);

    if (siffror.length === 10) {
      // Organisationsnummer skrivs med eller utan bindestreck. Registret lagrar
      // det med, så båda formerna ska leda rätt.
      const medStreck = `${siffror.slice(0, 6)}-${siffror.slice(6)}`;
      sokning = sokning.or(`org_number.eq.${medStreck},org_number.eq.${siffror}`);
    } else {
      // Komma och parentes har egen betydelse i PostgREST-uttryck, så de plockas
      // bort innan värdet stoppas in — samma skäl som rensaOrt i companiesRepo.
      const rensad = text.replace(/[^\p{L}\p{N}\s&-]/gu, "").trim();
      if (!rensad) return null;
      sokning = sokning.ilike("name", `%${rensad}%`);
    }

    return sokning.order("name").limit(Math.min(25, Math.max(1, antal)));
  };

  // merged_into tillkom efter registret gick live och kan saknas i en databas
  // där migrationen inte körts. Då faller uppslaget tillbaka på fälten som
  // alltid funnits, i stället för att sökningen slutar fungera helt.
  let fragan = kor(`${KOLUMNER}, merged_into`);
  if (!fragan) return { traffar: [] };

  let { data, error } = await fragan;

  if (error && `${error.message || ""}`.includes("merged_into")) {
    console.warn("companies.merged_into saknas — kör supabase/migration_sammanslagning.sql.");
    ({ data, error } = await kor(KOLUMNER));
  }

  if (error) return { fel: error };

  return { traffar: data ?? [] };
}
