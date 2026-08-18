import { redirect } from "next/navigation";

// Listsidan "Hitta bolag" är dold — /rekrytera fyller samma funktion och
// vidareutvecklas istället. Den gamla sidans kod ligger kvar i
// app/_hidden/bolag-list-page.js.txt om den behöver tas tillbaka.
// Profilsidorna /bolag/[id] är opåverkade.
export default function BolagPage() {
  redirect("/rekrytera");
}
