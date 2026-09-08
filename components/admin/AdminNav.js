"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDOR = [
  { href: "/admin", etikett: "Översikt" },
  { href: "/admin/fakturering", etikett: "Faktureringsunderlag" },
  { href: "/admin/moderera-forfragningar", etikett: "Granska förfrågningar", ko: "forfragningar" },
  { href: "/admin/kontoansokningar", etikett: "Kontoansökningar", ko: "ansokningar" },
  { href: "/admin/logg", etikett: "Loggbok" },
];

// Navigering mellan de interna sidorna. De tre som fanns sedan tidigare gick
// bara att nå genom att skriva adressen för hand — de hänger nu ihop med
// resten, med antalet obehandlade ärenden synligt hela tiden.
export default function AdminNav({ koer = {} }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {SIDOR.map((sida) => {
        const aktiv = sida.href === "/admin" ? pathname === "/admin" : pathname.startsWith(sida.href);
        const antal = sida.ko ? koer[sida.ko] : 0;
        return (
          <Link key={sida.href} href={sida.href} className={aktiv ? "active" : ""}>
            {sida.etikett}
            {antal > 0 && <span className="admin-nav-badge">{antal}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
