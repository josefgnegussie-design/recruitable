import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Klient för publika, oautentiserade serverkomponenter (t.ex. bolagsprofilen).
// Behöver inte cookies/sessionshantering — bara läsrättigheterna som redan
// gäller för alla via Row Level Security.
export function createPublicClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
