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
  "/logga-in",
  "/glomt-losenord",
  "/aterstall-losenord",
  "/admin",
  "/mina-sidor",
  "/api/profil",
  "/api/admin",
  "/api/mina-sidor",
];

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

  if (!pathname.startsWith("/mina-sidor")) {
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

  if (!user && request.nextUrl.pathname.startsWith("/mina-sidor")) {
    const url = request.nextUrl.clone();
    url.pathname = "/logga-in";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
