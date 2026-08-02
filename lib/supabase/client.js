import { createBrowserClient } from "@supabase/ssr";

// Klient för användning i "use client"-komponenter (webbläsaren).
// Bygger på NEXT_PUBLIC_-variabler, som är säkra att exponera i webbläsaren
// eftersom Row Level Security i databasen styr vad som faktiskt går att läsa/ändra.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
