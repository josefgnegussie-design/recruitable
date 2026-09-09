import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /api/stripe/webhook måste alltid vara nåbar, oavsett underhållsläge —
// annars kan Stripe aldrig meddela oss om lyckade betalningar/uppsägningar.
const MAINTENANCE_ALLOW = [
  "/coming-soon",
  "/favicon.ico",
  "/icon.png",
  "/icon.svg",
  "/robots.txt",
  "/sitemap.xml",
  "/logo",
  "/api/stripe/webhook",
  // Bevakningsjobbet ska kunna köra även när sajten står i underhållsläge —
  // annars tystnar larmet just när något är fel.
  "/api/cron",

  // Bekräftelselänkarna i Supabases auth-mejl landar här. Utan raden skrivs de
  // om till /coming-soon och länken är förbrukad när sajten väl öppnar. Att
  // lösa in länken skapar bara sessionen — inloggningssidan är ändå stängd, så
  // den som klickar kommer inte längre än till /coming-soon.
  "/auth/confirm",

  // Besöksmätningen ska fungera även i underhållsläge — annars saknas
  // siffrorna just för den period då vi som mest vill veta om någon hittar hit.
  "/api/statistik",
];

// Inloggning, lösenordsåterställning och hela admindelen ligger medvetet INTE i
// listan ovan: står sajten i underhållsläge ska ingen besökare kunna nå
// /logga-in. Den som driver sajten tar sig in med bypass-nyckeln nedan.
//
// Nyckeln sätts som miljövariabeln MAINTENANCE_BYPASS. Besök vilken adress som
// helst med ?nyckel=<värdet> — då sätts en kaka och resten av sajten öppnas som
// vanligt för just den webbläsaren, i en vecka. Utan variabel finns ingen
// bypass alls, och underhållsläget stänger då ute alla.
const BYPASS_KAKA = "underhall_bypass";
const BYPASS_PARAM = "nyckel";
const BYPASS_LIVSLANGD = 60 * 60 * 24 * 7;

// Jämförelsen tar lika lång tid oavsett hur många tecken som stämmer, så att
// svarstiden inte kan användas för att gissa nyckeln tecken för tecken.
function likaKonstantTid(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let skillnad = 0;
  for (let i = 0; i < a.length; i++) skillnad |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return skillnad === 0;
}

// Ett värde som klistrats in i Vercels formulär bär ofta med sig något som inte
// hör till nyckeln: omgivande citattecken, ett mellanslag, en radbrytning.
// Sådant syns inte i gränssnittet men får jämförelsen att missa, och felet blir
// omöjligt att skilja från en felskriven nyckel.
function skala(v) {
  if (typeof v !== "string") return "";
  return v.trim().replace(/^["']|["']$/g, "").trim();
}

// searchParams avkodar värdet, och i en adress betyder "+" mellanslag — en
// nyckel med "+" i sig kommer alltså aldrig fram hel den vägen. Därför jämförs
// även den råa strängen ur adressen, precis som den skrevs.
function nyckelUrAdressen(nextUrl) {
  const avkodad = nextUrl.searchParams.get(BYPASS_PARAM);
  const rad = nextUrl.search.slice(1).split("&").find((r) => r.startsWith(BYPASS_PARAM + "="));
  const raa = rad ? rad.slice(BYPASS_PARAM.length + 1) : null;
  return { avkodad, raa, angiven: avkodad !== null || raa !== null };
}

// Sidor som kräver inloggning. Här uppdateras sessionen, och den som saknar
// session skickas till inloggningen.
const SKYDDADE_SIDOR = ["/mina-sidor", "/admin"];

// API-rutter som läser sessionen. De ska få den uppdaterad på samma sätt, men
// aldrig omdirigeras — en fetch som får en inloggningssida i retur blir
// obegriplig för koden som anropade den. De svarar själva med 401/403.
const SESSIONSRUTTER = ["/api/mina-sidor", "/api/admin", "/api/profil"];

function matchar(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (process.env.MAINTENANCE_MODE === "1") {
    const nyckel = skala(process.env.MAINTENANCE_BYPASS);
    const { avkodad, raa, angiven } = nyckelUrAdressen(request.nextUrl);
    const traff =
      Boolean(nyckel) &&
      (likaKonstantTid(skala(avkodad), nyckel) || likaKonstantTid(skala(raa), nyckel));

    // Ett avvisat försök går inte att felsöka utifrån: en variabel som inte är
    // satt och en felskriven nyckel ger samma svar, med flit. Raden nedan
    // skiljer fallen åt i Vercels logg utan att röja något — bara huruvida
    // variabeln finns och hur långa strängarna är, aldrig innehållet.
    if (angiven && !traff) {
      console.warn(
        `[underhall] bypass avvisad: variabel_satt=${Boolean(nyckel)} langd_variabel=${nyckel.length} langd_angiven=${skala(avkodad ?? raa).length}`
      );
    }

    // Rätt nyckel i adressen: sätt kakan och skicka vidare till samma sida utan
    // nyckeln i adressfältet, så att den inte följer med i länkar, loggar eller
    // referrer-headern till andra sajter.
    if (traff) {
      const url = request.nextUrl.clone();
      url.searchParams.delete(BYPASS_PARAM);
      const svar = NextResponse.redirect(url);
      svar.cookies.set(BYPASS_KAKA, nyckel, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: BYPASS_LIVSLANGD,
      });
      return svar;
    }

    const harBypass =
      Boolean(nyckel) && likaKonstantTid(request.cookies.get(BYPASS_KAKA)?.value ?? "", nyckel);

    if (!harBypass && !MAINTENANCE_ALLOW.some((p) => matchar(pathname, p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/coming-soon";
      return NextResponse.rewrite(url);
    }
  }

  // Sessionen måste uppdateras här, i middlewaren. En serverkomponent kan läsa
  // kakan men inte skriva den — och när Supabase förnyar token får den en ny
  // refresh-token medan den gamla blir ogiltig. Sker det någon annanstans än
  // här går den nya förlorad, och kakan innehåller från och med då en
  // återkallad token. Nästa sidladdning ser då ut som en utloggning.
  //
  // Villkoret gällde länge bara /mina-sidor, vilket loggade ut administratören
  // ur /admin i tid och otid.
  const arSkyddadSida = SKYDDADE_SIDOR.some((p) => matchar(pathname, p));
  const arSessionsrutt = SESSIONSRUTTER.some((p) => matchar(pathname, p));

  if (!arSkyddadSida && !arSessionsrutt) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && arSkyddadSida) {
    const url = request.nextUrl.clone();
    url.pathname = "/logga-in";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
