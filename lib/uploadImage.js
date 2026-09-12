import { createClient } from "@/lib/supabase/client";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function kontrolleraBild(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Endast JPG, PNG eller WEBP är tillåtet.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("Bilden får max vara 5 MB.");
  }
}

async function laddaUpp(supabase, path, data) {
  const { error } = await supabase.storage.from("company-media").upload(path, data, {
    cacheControl: "3600",
    upsert: false,
    contentType: data.type || undefined,
  });

  if (error) throw new Error("Kunde inte ladda upp bilden. Försök igen.");

  const { data: publik } = supabase.storage.from("company-media").getPublicUrl(path);
  return publik.publicUrl;
}

// Sparar den beskurna bilden, och originalet bredvid under samma id.
//
// Bilderna sparades tidigare precis som de kom — en obehandlad mobilbild
// laddades ner i sin helhet av varje besökare som såg kortet. Nu sparas det
// utsnitt bolaget själv valt, nedskalat och som WebP.
//
// Originalet behövs för att en omframning ska utgå från full kvalitet i stället
// för att beskära en redan beskuren bild — zoomar man ut igen finns pixlarna
// kvar. Sökvägen är densamma med "original/" inskjutet, så den går att räkna
// fram utan att lagras.
export async function uploadCompanyImage(file, companyId, folder, beskuren) {
  kontrolleraBild(file);

  const supabase = createClient();
  const id = crypto.randomUUID();
  const originalExt = (file.name.split(".").pop() || "jpg").toLowerCase();

  if (!beskuren) {
    // Ingen beskärning gjord — spara filen som den är, som tidigare.
    return laddaUpp(supabase, `${companyId}/${folder}/${id}.${originalExt}`, file);
  }

  const url = await laddaUpp(supabase, `${companyId}/${folder}/${id}.webp`, beskuren);

  // Originalet får misslyckas utan att uppladdningen gör det. Bilden fungerar
  // ändå; det enda som går förlorat är möjligheten att rama om från full
  // kvalitet, och det är inte värt att avbryta en lyckad uppladdning för.
  try {
    await laddaUpp(supabase, `${companyId}/${folder}/original/${id}.${originalExt}`, file);
  } catch (err) {
    console.warn("Kunde inte spara originalet:", err.message);
  }

  return url;
}
