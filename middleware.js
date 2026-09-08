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

  // Underhållsläget ska dölja sajten för besökare, inte stänga ute den som
  // driver den. Utan raderna nedan gick varken inloggning, lösenordsåterställning
  // eller granskningsköerna att nå medan läget var på — inte ens
  // återställningslänken i mejlet, eftersom den pekar tillbaka hit. Den som glömt
  // sitt lösenord var utelåst tills sajten öppnades för alla.
  // Bekräftelselänkarna i Supabases auth-mejl landar här. Utan raden skrivs de
  // om till /coming-soon och länken är förbrukad när sajten väl öppnar.
  "/auth/confirm",
  "/logga-in",
  "/glomt-losenord",
  "/aterstall-losenord",
  "/admin",
  "/mina-sidor",
  "/api/profil",
  "/api/admin",
  "/api/mina-sidor",

  // Besöksmätningen ska fungera även i underhållsläge — annars saknas
  // siffrorna just för den period då vi som mest vill veta om någon hittar hit.
  "/api/statistik",
];

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

  if (
    process.env.MAINTENANCE_MODE === "1" &&
    !MAINTENANCE_ALLOW.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/coming-soon";
    return NextResponse.rewrite(url);
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
