import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { YRKESOMRADEN, GILTIGA_TJANSTER } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/lib/requestIp";
import { sendKontoansokanTillAdmins } from "@/lib/email";
import { bedomOvertagande, hinderForOvertagande } from "@/lib/overtagande";
import { bolagMedOrgnr, bolagMedSlug, efterBekraftelse } from "@/lib/overtagandeServer";

const VALID_AREAS = new Set(Object.keys(YRKESOMRADEN));

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTNUMMER_RE = /^\d{3}\s?\d{2}$/;

function isValidText(v, maxLen) {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

function giltigtNyttBolag(n) {
  return (
    n &&
    isValidText(n.companyName, 200) &&
    isValidText(n.orgNumber, 20) &&
    isValidText(n.gatuadress, 200) &&
    isValidText(n.postnummer, 10) &&
    POSTNUMMER_RE.test(n.postnummer.trim()) &&
    isValidText(n.postort, 100) &&
    isValidText(n.website, 200) &&
    Array.isArray(n.focusAreas) &&
    n.focusAreas.length > 0 &&
    n.focusAreas.length <= 21 &&
    n.focusAreas.every((a) => VALID_AREAS.has(a)) &&
    Array.isArray(n.services) &&
    n.services.length > 0 &&
    n.services.length <= 4 &&
    n.services.every((s) => GILTIGA_TJANSTER.has(s))
  );
}

// Skapar kontot och ansökan i ett och samma anrop, sist i formuläret.
//
// Kontot skapades förut i webbläsaren redan i första steget. Den som hoppade av
// stod då kvar med ett konto utan ansökan och kunde inte börja om, och
// bekräftelsemejlet kom medan formuläret var halvfärdigt. Nu valideras allt
// först, så att ett konto bara finns om ansökan också gör det.
//
// Den som redan är inloggad — till exempel efter ett avslag — ansöker med det
// kontot och behöver inget lösenord.
export async function POST(request) {
  const limited = await rateLimit(request, "registrera", 5, 3600);
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const { namn, epost: rawEpost, losenord, companySlug, nyttBolag, manuell, turnstileToken } = body;

  const session = await createClient();
  const {
    data: { user: inloggad },
  } = await session.auth.getUser();

  const epost = (inloggad?.email ?? (typeof rawEpost === "string" ? rawEpost : "")).trim().toLowerCase();

  if (
    !isValidText(namn, 200) ||
    !EMAIL_RE.test(epost) ||
    epost.length > 254 ||
    (!inloggad && (typeof losenord !== "string" || losenord.length < 8 || losenord.length > 72)) ||
    (!companySlug && !giltigtNyttBolag(nyttBolag))
  ) {
    return NextResponse.json({ error: "Ofullständig eller ogiltig förfrågan." }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken, clientIp(request)))) {
    return NextResponse.json({ error: "Kunde inte verifiera att du inte är en robot. Försök igen." }, { status: 403 });
  }

  const admin = createAdminClient();

  // Klienten har redan frågat registret, men ett organisationsnummer som finns
  // där ska kopplas även om det svaret aldrig kom fram.
  const bolag = companySlug
    ? await bolagMedSlug(admin, companySlug)
    : await bolagMedOrgnr(admin, nyttBolag.orgNumber);

  if (companySlug && !bolag) {
    return NextResponse.json({ error: "Bolaget hittades inte i registret." }, { status: 404 });
  }

  const hinder = bolag && hinderForOvertagande(bolag);
  if (hinder) return NextResponse.json({ error: hinder.text, kod: hinder.kod }, { status: 409 });

  const bedomning = bedomOvertagande({ epost, bolag, manuell: manuell === true });
  if (bedomning.lage === "fel_doman") {
    return NextResponse.json(
      { error: `Adressen matchar inte bolagets webbplats (${bedomning.doman}).`, kod: "fel_doman", doman: bedomning.doman },
      { status: 422 }
    );
  }

  let userId = inloggad?.id ?? null;
  let nyttKonto = false;

  if (inloggad) {
    const { data: rad } = await admin
      .from("company_admins")
      .select("id, verified")
      .eq("user_id", inloggad.id)
      .maybeSingle();
    if (rad?.verified) {
      return NextResponse.json({ error: "Kontot administrerar redan ett bolag.", kod: "redan_admin" }, { status: 409 });
    }
  } else {
    // Via den publika klienten och inte admin-API:et: det är signUp som skickar
    // bekräftelsemejlet.
    const { data, error } = await createPublicClient().auth.signUp({
      email: epost,
      password: losenord,
      options: { data: { namn: namn.trim() } },
    });

    if (error) {
      console.error("Kunde inte skapa konto:", error.message);
      return NextResponse.json({ error: "Kunde inte skapa kontot. Kontrollera uppgifterna och försök igen." }, { status: 400 });
    }

    // Med e-postbekräftelse påslagen svarar Supabase inte med ett fel när
    // adressen redan har ett bekräftat konto, utan med ett attrappkonto utan
    // identiteter. Skrivs en ansökan mot det hör den inte till någon.
    if (!data.user?.id || data.user.identities?.length === 0) {
      return NextResponse.json(
        { error: "Det finns redan ett konto med den adressen. Logga in så fortsätter vi därifrån.", kod: "konto_finns" },
        { status: 409 }
      );
    }

    userId = data.user.id;
    nyttKonto = true;
  }

  // En oavslutad ansökan ersätts: en användare ska ha en rad, och den senaste
  // ansökan är den som gäller.
  await admin.from("company_admins").delete().eq("user_id", userId).eq("verified", false);

  const adress = nyttBolag
    ? `${nyttBolag.gatuadress.trim()}, ${nyttBolag.postnummer.trim()} ${nyttBolag.postort.trim()}`
    : null;
  const automatisk = bedomning.lage === "automatisk";

  const { error: sparFel } = await admin.from("company_admins").insert({
    user_id: userId,
    company_id: null,
    full_name: namn.trim(),
    claimed_company_id: bolag?.id ?? null,
    claimed_company_name: bolag?.name ?? nyttBolag.companyName.trim(),
    claimed_org_number: bolag?.org_number ?? nyttBolag?.orgNumber?.trim() ?? null,
    claimed_address: adress,
    claimed_website: bolag?.link ?? nyttBolag?.website?.trim() ?? null,
    claimed_focus_areas: nyttBolag?.focusAreas ?? [],
    claimed_services: nyttBolag?.services ?? [],
    auto_godkann: automatisk,
    verified: false,
  });

  if (sparFel) {
    console.error("Kunde inte spara bolagsanspråk:", JSON.stringify(sparFel));
    // Kontot städas bort, annars är adressen låst för nästa försök.
    if (nyttKonto) await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Kunde inte spara ansökan. Försök igen." }, { status: 500 });
  }

  // Automatiska övertaganden meddelas när de aktiverats, se efterBekraftelse.
  if (!automatisk) {
    after(async () => {
      try {
        await sendKontoansokanTillAdmins({
          companyName: bolag?.name ?? nyttBolag.companyName.trim(),
          orgNumber: bolag?.org_number ?? nyttBolag?.orgNumber ?? "saknas",
          address: adress ?? "enligt registret",
          email: epost,
          website: bolag?.link ?? nyttBolag?.website ?? "saknas",
        });
      } catch (err) {
        console.error("Kunde inte skicka notis om kontoansökan:", err.message);
      }
    });
  }

  // Ett inloggat konto har redan bekräftad adress, så det finns inget att vänta på.
  const resultat = inloggad ? await efterBekraftelse(admin, inloggad) : null;
  if (resultat === "aktiverad") await session.auth.refreshSession();

  return NextResponse.json({ ok: true, lage: bedomning.lage, epost, aktiverad: resultat === "aktiverad" });
}
