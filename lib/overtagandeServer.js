import { stamplaBolagsadmin } from "@/lib/bolagsadmin";
import { bolagsdoman, domanMatchar, hinderForOvertagande } from "@/lib/overtagande";
import {
  sendAnsokanMottagenTillBolag,
  sendKontoGodkantTillBolag,
  sendOvertagandeTillAdmins,
} from "@/lib/email";

export const BOLAGSKOLUMNER = "id, name, slug, link, org_number, claimed, retired_at";

export function tillBolag(rad) {
  return rad ? { ...rad, upphort: Boolean(rad.retired_at) } : null;
}

// Registerraden för ett organisationsnummer, med eller utan bindestreck.
export async function bolagMedOrgnr(admin, orgnr) {
  const siffror = String(orgnr || "").replace(/\D/g, "");
  if (siffror.length !== 10) return null;
  const { data } = await admin
    .from("companies")
    .select(BOLAGSKOLUMNER)
    .or(`org_number.eq.${siffror},org_number.eq.${siffror.slice(0, 6)}-${siffror.slice(6)}`)
    .limit(1)
    .maybeSingle();
  return tillBolag(data);
}

export async function bolagMedSlug(admin, slug) {
  const rensad = String(slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(rensad)) return null;
  const { data } = await admin.from("companies").select(BOLAGSKOLUMNER).eq("slug", rensad).maybeSingle();
  return tillBolag(data);
}

// Vad som händer när mejladressen är bekräftad. Anropas från /auth/confirm och,
// som reserv, från Mina sidor: en bekräftelse som hann lösas in men vars
// aktivering föll, ska inte lämna kontot i ett läge som ingen ser.
//
// Går inte att köra två gånger: raden som läses måste vara overifierad, och
// uppdateringen är villkorad på det.
//
// Returnerar "aktiverad", "granskas" eller null när det inte fanns något att göra.
export async function efterBekraftelse(admin, user) {
  if (!user?.email_confirmed_at) return null;

  const { data: rad } = await admin
    .from("company_admins")
    .select("id, company_id, claimed_company_id, claimed_company_name, auto_godkann")
    .eq("user_id", user.id)
    .eq("verified", false)
    .maybeSingle();

  if (!rad) return null;

  if (!rad.auto_godkann) {
    await sendAnsokanMottagenTillBolag({ to: user.email, companyName: rad.claimed_company_name }).catch((err) =>
      console.error("Kunde inte skicka kvitto på ansökan:", err.message)
    );
    return "granskas";
  }

  const { data: bolagRad } = await admin
    .from("companies")
    .select(BOLAGSKOLUMNER)
    .eq("id", rad.claimed_company_id)
    .maybeSingle();
  const bolag = tillBolag(bolagRad);

  // Allt kontrolleras om. Sedan registreringen kan en kollega ha hunnit före,
  // och webbplatsen i registret kan ha ändrats.
  const hinder = !bolag || hinderForOvertagande(bolag) || !domanMatchar(user.email, bolag.link);
  if (hinder) return tillKon(admin, rad, user, "Domänen eller bolaget ändrades innan adressen bekräftades.");

  const { error, count } = await admin
    .from("company_admins")
    .update(
      {
        company_id: bolag.id,
        verified: true,
        ar_agare: true,
        godkand_at: new Date().toISOString(),
        godkand_av: "automatiskt",
      },
      { count: "exact" }
    )
    .eq("id", rad.id)
    .eq("verified", false);

  // 23505 är indexet en ägare per bolag: två personer bekräftade samtidigt. Den
  // som kom först är ägare, den andra hamnar hos en människa.
  if (error) {
    if (error.code !== "23505") console.error("Kunde inte aktivera övertagande:", JSON.stringify(error));
    return tillKon(admin, rad, user, "Någon annan tog över bolaget samtidigt.");
  }
  if (!count) return null;

  await admin.from("companies").update({ claimed: true }).eq("id", bolag.id);
  await stamplaBolagsadmin(admin, user.id);

  await Promise.all([
    sendKontoGodkantTillBolag({ to: user.email, companyName: bolag.name, companyId: bolag.id, slug: bolag.slug }),
    sendOvertagandeTillAdmins({
      companyName: bolag.name,
      orgNumber: bolag.org_number,
      epost: user.email,
      doman: bolagsdoman(bolag.link),
    }),
  ]).catch((err) => console.error("Kunde inte skicka besked om övertagande:", err.message));

  return "aktiverad";
}

async function tillKon(admin, rad, user, skal) {
  console.warn(`Övertagandet för ${user.id} gick till granskning: ${skal}`);
  await admin.from("company_admins").update({ auto_godkann: false }).eq("id", rad.id);
  await sendAnsokanMottagenTillBolag({ to: user.email, companyName: rad.claimed_company_name }).catch((err) =>
    console.error("Kunde inte skicka kvitto på ansökan:", err.message)
  );
  return "granskas";
}
