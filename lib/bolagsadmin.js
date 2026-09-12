import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Vem den inloggade är i förhållande till sitt bolag. Samlad här eftersom fem
// routes ställer samma fråga, och en av dem som glömmer kontrollera ar_agare
// är skillnaden mellan att en kontorschef kan säga upp bolagets prenumeration
// eller inte.
//
// Returnerar { fel } med ett färdigt svar när något inte stämmer, annars
// { admin, rad } — servicerollklienten och anroparens rad i company_admins.
export async function kravBolagsadmin({ kravAgare = false } = {}) {
  const { NextResponse } = await import("next/server");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { fel: NextResponse.json({ error: "Inte inloggad." }, { status: 401 }) };
  }

  const { data: rad } = await supabase
    .from("company_admins")
    .select("id, company_id, verified, ar_agare")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rad?.verified || !rad.company_id) {
    return { fel: NextResponse.json({ error: "Inte behörig." }, { status: 403 }) };
  }

  if (kravAgare && !rad.ar_agare) {
    return {
      fel: NextResponse.json(
        { error: "Bara kontots ägare kan göra det här. Be ägaren lämna över ansvaret först." },
        { status: 403 }
      ),
    };
  }

  return { admin: createAdminClient(), rad, user };
}

// Administratörerna för ett bolag, med mejladresserna hämtade ur auth.users.
// Adresserna bor inte i company_admins, så listan måste sättas ihop.
export async function hamtaAdministratorer(admin, companyId) {
  const { data: rader } = await admin
    .from("company_admins")
    .select("id, user_id, ar_agare, created_at")
    .eq("company_id", companyId)
    .eq("verified", true)
    .order("created_at", { ascending: true });

  return Promise.all(
    (rader ?? []).map(async (r) => {
      const { data } = await admin.auth.admin.getUserById(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        epost: data?.user?.email ?? null,
        arAgare: r.ar_agare,
        tillagd: r.created_at,
      };
    })
  );
}

// Stämplar kontot som bolagsadministratör i användarens metadata. Headern läser
// den ur den lokala sessionen för att veta vilka menyval som är meningsfulla —
// utan stämpeln hade varje sidvisning behövt en databasfråga för att avgöra det.
// Styr bara vad som visas; åtkomsten avgörs alltid på servern.
export async function stamplaBolagsadmin(admin, userId) {
  try {
    await admin.auth.admin.updateUserById(userId, { user_metadata: { bolagsadmin: true } });
  } catch (err) {
    console.error(`Kunde inte stämpla ${userId} som bolagsadmin:`, err.message);
  }
}
