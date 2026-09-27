// Källhänvisningarna på en bolagsprofil, hopfällda till ett ord.
//
// Profilen bar tidigare sina källor som löpande text under varje uppgift:
// "Källa: offentlig bolagsdata …", "Enligt bolagsordningen …", "Mätningarna är
// bolagets egna …". Var och en är rimlig, men tillsammans blev de en andra sida
// som besökaren måste läsa förbi för att komma åt det hen kom för. Uppgiften om
// varifrån ett tal kommer är viktig men sällan brådskande — den ska finnas, inte
// tränga sig på.
//
// Därför ett ord, "Källor", som fäller ut resten vid hover.
//
// Hover ensamt räcker dock inte: på en pekskärm finns ingen hover, och med
// tangentbord finns ingen musmarkör. Elementet är därför fokuserbart och rutan
// visas även vid :focus-visible och :focus-within — tryck på mobilen ger fokus,
// tabbning ger fokus, och musen ger hover. Samma uppgift når alla tre.
//
// Serverkomponent med flit: det här behöver ingen klientlogik, och profilsidan
// ska inte dra in JavaScript för en sak CSS klarar.
export default function Kallor({ children, etikett = "Källor" }) {
  return (
    <span className="kallor">
      <button type="button" className="kallor-knapp" aria-expanded="false">
        {etikett}
      </button>
      <span className="kallor-ruta" role="note">
        {children}
      </span>
    </span>
  );
}
