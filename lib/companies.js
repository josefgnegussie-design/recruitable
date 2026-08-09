// OBS: registret trimmades 2026-08-09 till bara Jovi Konsult, för att bygga
// klart hela flödet (registrering, profil, förfrågningar) kring ett enda
// riktigt bolag innan resten fylls på igen. Fullständig backup av samtliga
// 58 bolag finns sparad separat (Excel) innan den här ändringen gjordes.
export const COMPANIES = [
  {
    id:1, name:"Jovi Konsult AB", city:"Göteborg",
    address:"Götabergsgatan 20A, 411 34 Göteborg; Hertig Johans gata 10D, 541 30 Skövde",
    lat:57.6996584, lng:11.9715479,
    auktorisation:["Bemanning","Rekrytering"],
    focus:["Industriell tillverkning"],
    services:["Bemanning","Rekrytering"],
    sizeBand:"Medel", ka:true,
    founded:2016,
    revenue:"221,2 Mkr", revenueYear:2024,
    employees:"301", employeesYear:2024,
    rating:3.9, ratingCount:37,
    vision:"Vill vara bemanningsföretaget med mest närhet, tillgänglighet och hjärta i Västra Götaland.",
    desc:"Göteborgsbaserat bemannings- och rekryteringsbolag med kunder inom bland annat livsmedelsproduktion och verkstadsindustri.",
    contact:"josef.getachew@jovikonsult.se", link:"https://www.jovikonsult.se/",
    logo:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgoZiqrJrQwNXrfswdwFqAUTIJ5eZw5o2J7GVj5YkKGw&s=10"
  },
];
