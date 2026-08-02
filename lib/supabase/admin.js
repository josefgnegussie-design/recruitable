import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Administratörsklient med service role-nyckeln — går förbi Row Level
// Security helt. Används ENDAST på servern, i betrodd bakgrundskod
// (t.ex. när ett nytt adminkonto manuellt godkänns). Får aldrig
// importeras i kod som körs i webbläsaren.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
