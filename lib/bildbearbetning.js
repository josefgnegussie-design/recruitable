// Beskärning och nedskalning av en uppladdad bild, i webbläsaren.
//
// Bilderna sparades tidigare precis som de kom — en mobilbild på fem megabyte
// laddades ner i sin helhet av varje besökare som såg kortet, och `object-fit:
// cover` klippte den till 3:2, 16:9 eller en cirkel utan att bolaget hade något
// att säga till om.
//
// Utsnittet bakas in i filen i stället för att sparas som zoom och position.
// Samma bild visas i fyra olika format, och ett sparat "skala 1,4 och lite åt
// vänster" hade betytt olika saker i var och en av dem. Ett inbakat utsnitt ger
// ett svar överallt.

// Målmått per användning. Tilltagna för skärmar med hög pixeltäthet, men långt
// från en obehandlad kamerabild.
export const MALMATT = {
  bildspel: { bredd: 1600, hojd: 1067, forhallande: 3 / 2 },
  logo: { bredd: 600, hojd: 600, forhallande: 1 },
};

// createImageBitmap läser EXIF-rotationen, som annars lägger mobilbilder på
// sidan. Faller tillbaka på en vanlig Image där stödet saknas.
export async function laddaBild(kalla) {
  if (typeof createImageBitmap === "function" && kalla instanceof Blob) {
    try {
      return await createImageBitmap(kalla, { imageOrientation: "from-image" });
    } catch {
      // Vissa webbläsare känner inte imageOrientation — försök utan.
      try {
        return await createImageBitmap(kalla);
      } catch {
        /* faller igenom till Image nedan */
      }
    }
  }

  const url = kalla instanceof Blob ? URL.createObjectURL(kalla) : kalla;
  try {
    const bild = new Image();
    bild.crossOrigin = "anonymous";
    bild.src = url;
    await bild.decode();
    return bild;
  } finally {
    if (kalla instanceof Blob) URL.revokeObjectURL(url);
  }
}

// Bottenfärgen bakas in i filen. Zoomar bolaget ut förbi bildens kant fylls
// resten med vitt i stället för att lämnas genomskinlig — en genomskinlig WebP
// tog färg av vad den råkade ligga på: grå fält på korten, rutmönster i
// beskäraren. Det såg ut som ett fel snarare än som ett val. Vitt är dessutom
// samma botten som de flesta logotyper redan har, så matteringen syns inte.
export const BAKGRUND = "#fff";

// Ritar utsnittet i en färdig kontext. Både förhandsvisningen i beskäraren och
// exporten går genom den här, så den ena kan inte ändras utan den andra.
export function ritaUtsnitt(ctx, bild, utsnitt, bredd, hojd) {
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = BAKGRUND;
  ctx.fillRect(0, 0, bredd, hojd);
  ctx.drawImage(bild, utsnitt.x, utsnitt.y, utsnitt.bredd, utsnitt.hojd, 0, 0, bredd, hojd);
}

// Skär ut rektangeln (i bildens egna pixlar) och skalar den till målmåttet.
// WebP med kvalitet 0,85 — omärkbart för ögat, en bråkdel av storleken.
export async function beskarTillBlob(bild, utsnitt, mal) {
  const canvas = document.createElement("canvas");
  canvas.width = mal.bredd;
  canvas.height = mal.hojd;

  ritaUtsnitt(canvas.getContext("2d"), bild, utsnitt, mal.bredd, mal.hojd);

  const blob = await new Promise((klar) => canvas.toBlob(klar, "image/webp", 0.85));
  if (!blob) throw new Error("Kunde inte bearbeta bilden.");
  return blob;
}

// Största utsnitt med rätt förhållande som får plats i bilden, centrerat.
// Utgångsläget när beskäraren öppnas: hela bilden, så långt formatet tillåter.
export function startutsnitt(bredd, hojd, forhallande) {
  const utsnittBredd = Math.min(bredd, hojd * forhallande);
  const utsnittHojd = utsnittBredd / forhallande;
  return {
    x: (bredd - utsnittBredd) / 2,
    y: (hojd - utsnittHojd) / 2,
    bredd: utsnittBredd,
    hojd: utsnittHojd,
  };
}
