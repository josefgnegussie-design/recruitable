import { redirect } from "next/navigation";

// Listan ligger på /mina-sidor. Adressen här finns bara för att den som kortar
// en förfrågelänk ska hamna rätt och inte på en 404.
export default function ForfragningarPage() {
  redirect("/mina-sidor");
}
