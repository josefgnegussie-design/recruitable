import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { hamtaStatistik, tolkaManad } from "@/lib/statistik";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KOLUMNER = [
  ["Bolags-id", (r) => r.company_id],
  ["Bolag", (r) => r.bolag],
  ["Ort", (r) => r.ort],
  ["Premium", (r) => (r.premium ? "Ja" : "Nej")],
  ["Utskick", (r) => r.utskick],
  ["Accepterade", (r) => r.accepterade],
  ["Nekade", (r) => r.nekade],
  ["Obesvarade", (r) => r.obesvarade],
  ["Median svarstid (h)", (r) => (r.median_svarstid_timmar != null ? r.median_svarstid_timmar : "")],
];

// Ett fält som börjar med =, +, - eller @ tolkas av Excel som en formel.
// Apostrofen framför gör det till text igen. Bolagsnamnen kommer från
// registret och ska aldrig kunna köra något i mottagarens kalkylark.
function cell(varde) {
  const text = String(varde ?? "");
  const skyddad = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${skyddad.replace(/"/g, '""')}"`;
}

// Faktureringsunderlaget som CSV. Semikolon som avgränsare och BOM först,
// eftersom det är vad svenska Excel öppnar rätt utan importdialog.
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Inte behörig." }, { status: 403 });
  }

  const manad = tolkaManad(request.nextUrl.searchParams.get("manad"));
  const { data, saknasMigration, fel } = await hamtaStatistik("statistik_underlag_per_bolag", {
    p_fran: manad.fran,
    p_till: manad.till,
  });

  if (saknasMigration) {
    return NextResponse.json(
      { error: "Kör supabase/migration_statistik.sql i Supabase först." },
      { status: 503 }
    );
  }

  if (fel) {
    return NextResponse.json({ error: "Kunde inte hämta underlaget." }, { status: 500 });
  }

  const rader = data || [];
  const rubriker = KOLUMNER.map(([namn]) => cell(namn)).join(";");
  const kropp = rader.map((r) => KOLUMNER.map(([, las]) => cell(las(r))).join(";"));

  const totalt = ["Totalt", "", "", ""].map(cell);
  for (const falt of ["utskick", "accepterade", "nekade", "obesvarade"]) {
    totalt.push(cell(rader.reduce((s, r) => s + Number(r[falt] || 0), 0)));
  }
  totalt.push(cell(""));

  const csv = `﻿${[rubriker, ...kropp, totalt.join(";")].join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recruitable-underlag-${manad.nyckel}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
