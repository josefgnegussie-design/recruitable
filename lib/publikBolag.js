// Den publika formen av ett bolag ur registret.
//
// companiesRepo lämnar ut kontaktadressen eftersom den behövs internt, men den
// hör inte hemma i något som går ut till en besökare. Sökresultatet serveras
// både som JSON från /api/bolag/sok och som props till förfrågningsguiden, och i
// båda fallen låg adressen med i klartext — registrets hundra kontaktadresser
// var hämtbara med en request, utan nyckel och utan att logga något.
//
// Rätta stället vore fromRow i companiesRepo, som är den enda plats fältet
// uppstår. Strykningen ligger här tills vidare för att repot just nu skrivs om
// av annat arbete; när det är incheckat ersätter en rad i fromRow båda
// anropen nedan.
function utanKontakt(bolag) {
  const kopia = { ...bolag };
  delete kopia.contact;
  return kopia;
}

export function publikaBolag(lista) {
  return (lista || []).map(utanKontakt);
}
