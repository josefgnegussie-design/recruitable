import { createClient } from "@/lib/supabase/client";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadCompanyImage(file, companyId, folder) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Endast JPG, PNG eller WEBP är tillåtet.");
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("Bilden får max vara 5 MB.");
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${companyId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("company-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error("Kunde inte ladda upp bilden. Försök igen.");

  const { data } = supabase.storage.from("company-media").getPublicUrl(path);
  return data.publicUrl;
}
