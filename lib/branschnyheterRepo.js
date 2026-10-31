import { INDUSTRY_NEWS } from "@/lib/industryNews";
import { titelNyckel } from "@/lib/branschnyheter";
import { createPublicClient } from "@/lib/supabase/public";

const DATUM = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Stockholm",
});

// De senaste nyheterna för startsidan. Tabellen fylls av cron-jobbet och
// INDUSTRY_NEWS fyller på när den ger för få rader, så sektionen aldrig blir
// tom. Ett fel här får inte fälla startsidan: då visas listan i stället.
export async function hamtaSenasteNyheter(antal = 5) {
  let rader = [];
  try {
    const { data, error } = await createPublicClient()
      .from("branschnyheter")
      .select("titel, kalla, url, publicerad_at")
      .order("publicerad_at", { ascending: false })
      .limit(antal);
    if (error) throw error;
    rader = data ?? [];
  } catch (err) {
    console.warn("Branschnyheterna kunde inte läsas, visar reservlistan:", err.message);
  }

  const nyheter = rader.map((r) => ({
    title: r.titel,
    source: r.kalla,
    date: DATUM.format(new Date(r.publicerad_at)),
    url: r.url,
  }));

  // Samma nyhet kan ligga i båda: Kompetensföretagens flöde går tillbaka till maj.
  const sedda = new Set(nyheter.map((n) => titelNyckel(n.title)));
  const reserv = INDUSTRY_NEWS.filter((n) => !sedda.has(titelNyckel(n.title)));

  return [...nyheter, ...reserv].slice(0, antal);
}
