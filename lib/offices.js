import { createAdminClient } from "@/lib/supabase/admin";

// Slår upp rätt mottagare för en förfrågan till ett bolag: om bolaget har
// ett betalt kontor (offices.paid = true) vars ort matchar förfrågans ort,
// går den till kontorets egen kontaktperson (t.ex. kontorschefen i
// Falkenberg) istället för bolagets generella kontakt. Ingen träff faller
// tillbaka till fallbackContact — vanligtvis companies.contact.
//
// Anropas medvetet inte än — aktiveras när mejl #3
// (sendInquiryReceivedToCompany) kopplas in i
// app/api/admin/moderera-forfragan/route.js, se sparad påminnelse i
// projektminnet om att vänta tills fler bolag är registrerade.
export async function resolveCompanyContact(companyId, requesterCity, fallbackContact) {
  if (requesterCity) {
    const admin = createAdminClient();
    const { data: office } = await admin
      .from("offices")
      .select("contact_name, contact_email")
      .eq("company_id", companyId)
      .eq("paid", true)
      .ilike("city", requesterCity.trim())
      .maybeSingle();

    if (office?.contact_email) {
      return { name: office.contact_name, email: office.contact_email };
    }
  }

  return fallbackContact ? { name: null, email: fallbackContact } : null;
}
