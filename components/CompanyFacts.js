// De uppgifter bolaget självt svarar för, renderade likadant överallt de dyker
// upp: sökkortet på /rekrytera, urvalskortet i förfrågningsflödet och
// profilsidan. Ligger samlat här av samma skäl som mapInquiryRow i
// lib/inquiries.js — tre kopior av samma villkor blir förr eller senare tre
// olika svar på frågan vad ett bolag erbjuder.

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
          Kundnöjdhet <b>{kund}</b> / 5
          {visaKalla && surveys.customer_satisfaction.source
            ? ` — ${surveys.customer_satisfaction.source}`
            : ""}
        </span>
      )}
      {medarbetare && (
        <span>
          Medarbetarnöjdhet <b>{medarbetare}</b> / 5
          {visaKalla && surveys.employee_satisfaction.source
            ? ` — ${surveys.employee_satisfaction.source}`
            : ""}
        </span>
      )}
    </div>
  );
}
