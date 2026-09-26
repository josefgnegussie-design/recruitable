// De uppgifter bolaget självt svarar för, renderade likadant överallt de dyker
// upp: sökkortet på /rekrytera, urvalskortet i förfrågningsflödet och
// profilsidan. Ligger samlat här av samma skäl som mapInquiryRow i
// lib/inquiries.js — tre kopior av samma villkor blir förr eller senare tre
// olika svar på frågan vad ett bolag erbjuder.

import { sorteradeIso } from "@/lib/iso";

// En stämpel per ISO-certifiering, med titeln utskriven — "ISO 14001" säger
// inget för den som inte kan standarderna utantill. Ingen "EJ ISO"-stämpel: ett
// bolag som inte angett något och ett som saknar certifiering går inte att
// skilja åt, så kortet tiger hellre.
export function IsoStamplar({ iso }) {
  const lista = sorteradeIso(iso);
  if (!lista.length) return null;
  return (
    <div className="iso-stamplar">
      {lista.map((c) => (
        <div className="stamp" key={c.kod}>
          <span>
            {c.kod} · {c.namn}
          </span>
        </div>
      ))}
    </div>
  );
}

// De jämförbara uppgifterna i en liten ruta högt upp på korten, i samma form
// som faktaraden på profilsidan. Stod förut utspridda: kollektivavtal och ISO
// som en kolumn stämplar i hörnet, omsättning och medarbetare längst ner under
// bildspelet — och på urvalskortet inte alls. Nu ligger de på samma ställe i
// varje kort, så att den som jämför bolag kan läsa rakt nedåt i listan.
//
// Nyckeltalen på en rad med tre fält. ISO får en egen rad under, i hela
// bredden, så att varje certifiering kan stå med sin titel. Raden finns bara
// när bolaget angett en certifiering; se IsoStamplar.
export function Faktaruta({ company: c }) {
  const iso = sorteradeIso(c.iso);
  return (
    <div className="faktaruta">
      <div>
        <div className="k">Medarbetare{c.employeesYear ? ` ${c.employeesYear}` : ""}</div>
        <div className="v">{c.employees || "—"}</div>
      </div>
      <div>
        <div className="k">Omsättning{c.revenueYear ? ` ${c.revenueYear}` : ""}</div>
        <div className="v">{c.revenue || "—"}</div>
      </div>
      <div>
        <div className="k">Kollektivavtal</div>
        <div className="v">{c.ka ? "Ja" : "Nej"}</div>
      </div>
      {iso.length > 0 && (
        <div className="iso">
          <div className="k">ISO-certifiering</div>
          {iso.map((i) => (
            <div className="iso-rad" key={i.kod}>
              <span className="v">{i.kod}</span> {i.namn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Svensk decimalkomma. Number(v) eftersom poängen kommer ur jsonb och kan ligga
// där som sträng om den skrivits av något annat än formuläret. Exporterad så att
// profilsidan visar samma siffra på samma sätt som korten.
export function betyg(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : null;
}

// Tjänster först och fyllda, sedan yrkesområdena konturade. Ordningen är
// medveten: tjänsten avgör om bolaget överhuvudtaget är aktuellt, området
// avgör om de kan branschen.
export function CompanyTags({ services = [], focus = [] }) {
  if (!services.length && !focus.length) return null;
  return (
    <div className="tag-row">
      {services.map((s) => (
        <span className="tag service" key={`t-${s}`}>
          {s}
        </span>
      ))}
      {focus.map((f) => (
        <span className="tag" key={`o-${f}`}>
          {f}
        </span>
      ))}
    </div>
  );
}

// "Kundnöjdhet 2025" — samma form som "Medarbetare 2024" i faktarutan. Mätningar
// sparade innan årtalet infördes saknar det och visas med bara namnet, tills
// bolaget sparar profilen igen (formuläret kräver då ett år).
export function undersokningsRubrik(namn, undersokning) {
  return undersokning?.year ? `${namn} ${undersokning.year}` : namn;
}

// Undersökningarna visas bara med sin källa. En siffra utan källa säger inget om
// vad som mätts eller när, och bolaget skriver in båda själv.
export function CompanySurveys({ surveys, visaKalla = false }) {
  const kund = betyg(surveys?.customer_satisfaction?.score);
  const medarbetare = betyg(surveys?.employee_satisfaction?.score);
  if (!kund && !medarbetare) return null;

  return (
    <div className="card-surveys">
      {kund && (
        <span>
          {undersokningsRubrik("Kundnöjdhet", surveys.customer_satisfaction)} <b>{kund}</b> / 5
          {visaKalla && surveys.customer_satisfaction.source
            ? ` — ${surveys.customer_satisfaction.source}`
            : ""}
        </span>
      )}
      {medarbetare && (
        <span>
          {undersokningsRubrik("Medarbetarnöjdhet", surveys.employee_satisfaction)} <b>{medarbetare}</b> / 5
          {visaKalla && surveys.employee_satisfaction.source
            ? ` — ${surveys.employee_satisfaction.source}`
            : ""}
        </span>
      )}
    </div>
  );
}
