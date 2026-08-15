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
];

// Lösenordsskyddar alla Preview-driftsättningar med HTTP Basic Auth, så vi
// kan dela en staging-länk med t.ex. andra utan Vercel-konto och slippa
// slå på underhållsläget i produktion bara för att visa något under
// utveckling. Aktivt enbart när VERCEL_ENV="preview" (sätts automatiskt av
// Vercel) — rör aldrig produktion.
function isStagingAuthorized(request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(auth.slice(6));
    const password = decoded.slice(decoded.indexOf(":") + 1);
    return password === process.env.STAGING_PASSWORD;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (process.env.VERCEL_ENV === "preview" && !isStagingAuthorized(request)) {
    return new NextResponse("Autentisering krävs.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Recruitable staging"' },
    });
  }

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
