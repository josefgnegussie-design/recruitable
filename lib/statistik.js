import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/requestIp";

// Delad grund för Recruitables egen statistik: perioder, den cookielösa
// besöksmätningen och anropen mot statistikfunktionerna i databasen.
//
// Allt här körs bara på servern. Filen importerar service role-klienten och
// får därför aldrig nå webbläsaren.

export const PERIODER = {
  7: "7 dagar",
  30: "30 dagar",
  90: "90 dagar",
  365: "12 månader",
};

export const STANDARDPERIOD = 30;

// Tolkar ?period= från adressfältet till ett intervall, plus föregående lika
// långa intervall så varje siffra kan visas med en förändring mot förra
// perioden. Okända värden faller tillbaka på standard istället för att fela —
// adressfältet är användarens, inte vårt.
export function tolkaPeriod(varde) {
  const dagar = Object.keys(PERIODER).map(Number).includes(Number(varde))
    ? Number(varde)
    : STANDARDPERIOD;

  const till = new Date();
  const fran = new Date(till.getTime() - dagar * 24 * 60 * 60 * 1000);
  const foregaendeFran = new Date(fran.getTime() - dagar * 24 * 60 * 60 * 1000);

  return {
    dagar,
    etikett: PERIODER[dagar],
    fran: fran.toISOString(),
    till: till.toISOString(),
    foregaende: { fran: foregaendeFran.toISOString(), till: fran.toISOString() },
  };
}

// Månad i formatet YYYY-MM → intervallet [första i månaden, första i nästa).
// Ogiltiga värden ger innevarande månad.
export function tolkaManad(varde) {
  const traff = /^(\d{4})-(\d{2})$/.exec(String(varde || ""));
  const nu = new Date();
  const ar = traff ? Number(traff[1]) : nu.getUTCFullYear();
  const manad = traff ? Number(traff[2]) - 1 : nu.getUTCMonth();

  if (!traff || manad < 0 || manad > 11) {
    return tolkaManad(`${nu.getUTCFullYear()}-${String(nu.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const fran = new Date(Date.UTC(ar, manad, 1));
  const till = new Date(Date.UTC(ar, manad + 1, 1));

  return {
    nyckel: `${ar}-${String(manad + 1).padStart(2, "0")}`,
    etikett: fran.toLocaleDateString("sv-SE", { year: "numeric", month: "long", timeZone: "UTC" }),
    fran: fran.toISOString(),
    till: till.toISOString(),
  };
}

// De senaste N månaderna som väljbara alternativ, nyaste först.
export function senasteManader(antal = 12) {
  const nu = new Date();
  return Array.from({ length: antal }, (_, i) => {
    const d = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() - i, 1));
    return tolkaManad(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  });
}

// Robotar och förhandsgranskare ska inte räknas som besökare. Listan fångar
// inte allt — den fångar det som annars dominerar siffrorna på en liten sajt.
const ROBOT_RE =
  /bot|crawl|spider|slurp|search|preview|monitor|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http|java\/|okhttp|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slackbot|vercel-screenshot/i;

export function arRobot(userAgent) {
  if (!userAgent) return true; // en riktig webbläsare skickar alltid user agent
  return ROBOT_RE.test(userAgent);
}

// Envägshash av dagens salt + IP + user agent. Bytet av salt vid midnatt gör
// att samma person inte går att följa mellan dygn, och varken IP eller user
// agent sparas någonstans. Saknas STATISTIK_SALT returneras null: hellre
// ingen besökarsiffra än en pseudonym som går att räkna baklänges.
export function besokarHash(request) {
  const salt = process.env.STATISTIK_SALT;
  if (!salt) return null;

  const dag = new Date().toISOString().slice(0, 10);
  const ip = clientIp(request);
  const ua = request.headers.get("user-agent") || "";

  return createHash("sha256").update(`${salt}|${dag}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

// Sökvägar vi aldrig mäter: vårt eget interna, och allt som inte ser ut som en
// vanlig sida. Utan filtret hade adressfältet varit ett öppet fält rakt in i
// statistiktabellen.
// %-tecknet är med eftersom webbläsaren procent-kodar icke-ASCII i pathname:
// en framtida sökväg med å, ä eller ö kommer hit som /bransch-s%C3%B6k och
// skulle annars falla bort tyst.
const SOKVAG_RE = /^\/[\p{L}\p{N}\-_/.~%]{0,200}$/u;

export function stadaSokvag(rawPath) {
  if (typeof rawPath !== "string") return null;
  const utanFraga = rawPath.split("?")[0].split("#")[0];
  const path = utanFraga.length > 1 ? utanFraga.replace(/\/+$/, "") : utanFraga;
  if (!path.startsWith("/") || !SOKVAG_RE.test(path)) return null;
  if (path.startsWith("/admin") || path.startsWith("/api")) return null;
  return path;
}

// Skriver en händelse. Får aldrig fälla anropet den sitter i — en sida som
// inte kan mätas ska ändå levereras. Därför fångas allt och loggas bara.
export async function loggaHandelse({ eventType, path, visitorHash = null, metadata = {} }) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("site_events").insert({
      event_type: eventType,
      path,
      visitor_hash: visitorHash,
      metadata,
    });
    if (error) console.error("Kunde inte logga händelse:", JSON.stringify(error));
  } catch (err) {
    console.error("Kunde inte logga händelse:", err.message);
  }
}

// Postgres/PostgREST-koderna för "tabellen finns inte" och "funktionen finns
// inte i schemat". De betyder i praktiken en sak här: migrationen är inte körd.
const SAKNAS_KODER = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

export function migrationSaknas(error) {
  if (!error) return false;
  if (SAKNAS_KODER.has(error.code)) return true;
  return /could not find|does not exist|schema cache/i.test(error.message || "");
}

// Anropar en av statistikfunktionerna och skiljer "inget hänt än" från
// "migrationen är inte körd". Skillnaden spelar roll: en tom dashboard som
// egentligen betyder att SQL-filen aldrig kördes är precis det misstag som
// tidigare bröt registreringen tyst.
export async function hamtaStatistik(funktion, args = {}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(funktion, args);

  if (error) {
    if (migrationSaknas(error)) return { data: null, saknasMigration: true, fel: null };
    console.error(`Statistikfunktionen ${funktion} misslyckades:`, JSON.stringify(error));
    return { data: null, saknasMigration: false, fel: error.message || "Okänt fel" };
  }

  return { data: data ?? [], saknasMigration: false, fel: null };
}

// Procentuell förändring mot föregående period. null när jämförelsen inte
// säger något (ingen historik att jämföra med).
export function forandring(nu, forr) {
  if (!forr) return null;
  return Math.round(((nu - forr) / forr) * 100);
}

export function andel(del, helhet) {
  if (!helhet) return null;
  return Math.round((del / helhet) * 100);
}
