import { sendInquiryConfirmationToRequester, sendModerationAlertToAdmins } from "@/lib/email";
import { upphordaAv } from "@/lib/sammanslagning";
import { nyUppfoljningstoken, uppfoljningsSokvag } from "@/lib/uppfoljning";

// Det som händer efter valideringen när en beställare skickar något till ett
// antal bolag: en förfrågan från Rekrytera eller en inbjudan från Upphandling.
// Båda går samma väg härifrån — granskning, mottagare i inquiry_recipients,
// uppföljningslänk och mejl — så att bolagen svarar på samma sätt på Mina sidor
// och kontaktuppgifterna låses upp vid accept, oavsett var förfrågan kom ifrån.
//
// Returnerar { svar } med det routen ska skicka tillbaka, eller { fel, status }.
export async function sparaOchSkickaForfragan(supabase, { rad, companyIds, mejl, extra = {}, reserv = {} }) {
  // Slå upp de valda bolagen. Det här är både existenskontrollen och källan till
  // namnen i mejlen — tidigare hämtades namnen ur den statiska filen, som inte
  // känner till bolag som tillkommit i registret sedan senaste driftsättning.
  const { data: valdaBolag, error: bolagError } = await supabase
    .from("companies")
    .select("id, name")
    .in("id", companyIds);

  if (bolagError) {
    console.error("Kunde inte slå upp valda bolag:", JSON.stringify(bolagError));
    return { fel: "Kunde inte spara förfrågan. Försök igen.", status: 500 };
  }

  if (!valdaBolag || valdaBolag.length !== companyIds.length) {
    return { fel: "Ett eller flera av de valda bolagen finns inte längre i registret.", status: 400 };
  }

  // Ett bolag som slagits ihop eller avregistrerats försvinner ur sökningen, men
  // en sida som stått öppen sedan före dess har kryssrutan kvar. Utan kontrollen
  // landar förfrågan hos ett bolag som inte finns kvar, och blir aldrig besvarad.
  const upphorda = await upphordaAv(supabase, companyIds);
  if (upphorda.length) {
    return {
      fel: "Ett eller flera av de valda bolagen finns inte längre i registret. Ladda om sidan och sök på nytt.",
      status: 400,
    };
  }

  // Uppföljningslänken till beställaren. Saknas en kolumn har en migration inte
  // körts: förfrågan sparas då utan den i stället för att gå förlorad. `extra`
  // är kolumner som bara vissa förfrågningar har (upphandlingens detaljer), och
  // `reserv` det som ska skrivas i deras ställe om kolumnerna saknas.
  const uppfoljning = nyUppfoljningstoken();
  const forsok = [
    { ...rad, ...extra, uppfoljning_token_hash: uppfoljning.tokenHash },
    { ...rad, ...reserv, uppfoljning_token_hash: uppfoljning.tokenHash },
    { ...rad, ...reserv },
  ];
  // Utan extra kolumner är de två första försöken samma sak.
  if (!Object.keys(extra).length) forsok.shift();

  let inquiry = null;
  let inquiryError = null;
  let uppfoljningsLank = null;
  for (const [i, forfraganRad] of forsok.entries()) {
    ({ data: inquiry, error: inquiryError } = await supabase.from("inquiries").insert(forfraganRad).select("id").single());
    const saknadKolumn = inquiryError && (inquiryError.code === "42703" || inquiryError.code === "PGRST204");
    if (!saknadKolumn) {
      uppfoljningsLank = "uppfoljning_token_hash" in forfraganRad ? uppfoljningsSokvag(uppfoljning.token) : null;
      break;
    }
    console.error(
      i === forsok.length - 1
        ? "inquiries saknar kolumner trots reservvägen."
        : `inquiries saknar en kolumn (${inquiryError.message}) — kör migrationerna i supabase/.`
    );
  }

  if (inquiryError || !inquiry) {
    console.error("Kunde inte spara förfrågan:", JSON.stringify(inquiryError));
    return { fel: "Kunde inte spara förfrågan. Försök igen.", status: 500 };
  }

  const recipients = companyIds.map((companyId) => ({ inquiry_id: inquiry.id, company_id: companyId }));
  const { error: recipientsError } = await supabase.from("inquiry_recipients").insert(recipients);

  if (recipientsError) {
    console.error("Kunde inte spara mottagare:", JSON.stringify(recipientsError));
    return { fel: "Kunde inte spara förfrågan. Försök igen.", status: 500 };
  }

  const inquiryForEmail = { ...mejl, companyNames: valdaBolag.map((c) => c.name), uppfoljningsLank };

  // Bekräftelse till avsändaren och granskningsnotis till plattformsadmin
  // skickas alltid — best effort, misslyckas aldrig hela requesten.
  // Bolagen som valts får inget mejl härifrån: det skickas när förfrågan
  // godkänns i /api/admin/moderera-forfragan, annars hade granskningen varit
  // meningslös.
  await Promise.allSettled([
    sendInquiryConfirmationToRequester(inquiryForEmail),
    sendModerationAlertToAdmins(inquiryForEmail),
  ]);

  // Länken går också tillbaka till webbläsaren, så att tacksidan kan visa den.
  // Det är beställarens egen förfrågan, och token är samma som i mejlet.
  return { svar: { ok: true, count: recipients.length, uppfoljning: uppfoljningsLank } };
}
