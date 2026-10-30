"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { kommerFranTraffar } from "@/lib/franTraffar";

// Länken pekar alltid på /rekrytera, så att den fungerar utan JavaScript och för
// den som kom hit från en sökmotor. Kom besökaren från en träfflista går klicket
// i stället bakåt i historiken, så att träffarna och filtret står kvar.
export default function TillbakaTillSokningen() {
  const router = useRouter();

  function vidKlick(e) {
    if (!kommerFranTraffar(window.location.pathname)) return;
    e.preventDefault();
    router.back();
  }

  return (
    <Link className="back-link" href="/rekrytera" onClick={vidKlick}>
      &larr; Tillbaka till sökningen
    </Link>
  );
}
