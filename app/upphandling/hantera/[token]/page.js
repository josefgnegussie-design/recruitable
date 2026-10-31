import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hamtaKoparvy } from "@/lib/upphandlingRepo";
import KoparVy from "@/components/upphandling/KoparVy";

// Läses vid varje besök, så att en ny anmälan syns när köparen laddar om.
export const dynamic = "force-dynamic";

// Länken är personlig och ska inte hamna i ett sökindex.
export const metadata = {
  title: "Er upphandling",
  robots: { index: false, follow: false },
};

export default async function HanteraUpphandlingPage({ params }) {
  const { token } = await params;
  const u = await hamtaKoparvy(createAdminClient(), token);
  if (!u) notFound();
  return <KoparVy u={u} token={token} />;
}
