import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Klient för Server Components och Route Handlers. Läser/skriver
// inloggningssessionen via cookies, så en inloggning håller sig kvar
// mellan sidladdningar. Kräver att sajten körs som en riktig server
// (inte statisk export) — kopplas in när vi gör DNS-bytet till Vercel.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Anropas ibland från en Server Component där cookies inte går att
            // skriva direkt — ofarligt, sessionen uppdateras ändå av middleware.
          }
        },
      },
    }
  );
}
