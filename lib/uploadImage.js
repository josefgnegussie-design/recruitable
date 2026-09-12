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

// Delarna av en sparad bild-URL: bolagsmapp, undermapp och id. Null när URL:en
// inte följer mönstret — bilder som laddades upp innan beskärningen fanns.
function delar(url) {
  const utanFraga = String(url || "").split("?")[0];
  const m = utanFraga.match(/\/company-media\/(\d+)\/([^/]+)\/([^/]+)\.webp$/);
  return m ? { companyId: m[1], folder: m[2], id: m[3] } : null;
}

// Originalet till en sparad bild, för omframning. Filändelsen är inte känd —
// originalet behåller källfilens — så mappen listas i stället för att tre
// gissningar prövas.
export async function hamtaOriginalBlob(url) {
  const d = delar(url);
  const supabase = createClient();

  if (d) {
    const { data } = await supabase.storage
      .from("company-media")
      .list(`${d.companyId}/${d.folder}/original`, { search: d.id, limit: 1 });

    const namn = data?.[0]?.name;
    if (namn) {
      const { data: publik } = supabase.storage
        .from("company-media")
        .getPublicUrl(`${d.companyId}/${d.folder}/original/${namn}`);
      const res = await fetch(publik.publicUrl);
      if (res.ok) return res.blob();
    }
  }

  // Inget original — bilden laddades upp innan beskärningen fanns, eller
  // originalet gick inte att spara. Den beskurna bilden duger att rama om
  // inom; det enda som inte går är att zooma ut förbi det tidigare utsnittet.
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunde inte hämta bilden för omframning.");
  return res.blob();
}

// Ersätter den beskurna filen på samma plats, så kopplingen till originalet
// består. Adressen får en versionsparameter — utan den fortsätter webbläsare
// och CDN att visa den gamla bilden från cachen.
export async function ersattBeskuren(url, beskuren) {
  const d = delar(url);
  if (!d) throw new Error("Bilden går inte att rama om.");

  const supabase = createClient();
  const path = `${d.companyId}/${d.folder}/${d.id}.webp`;

  const { error } = await supabase.storage.from("company-media").upload(path, beskuren, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });

  if (error) throw new Error("Kunde inte spara den nya utsnittet. Försök igen.");

  const { data } = supabase.storage.from("company-media").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Går bilden att rama om? Bara våra egna beskurna filer har en känd sökväg.
export function garAttRamaOm(url) {
  return Boolean(delar(url));
}
