// Sveriges 21 län med samtliga 290 kommuner (Region Gotland räknas som en kommun)
export const REGION_MAP = {
  "Blekinge län": ["Karlshamn","Karlskrona","Olofström","Ronneby","Sölvesborg"],
  "Dalarnas län": ["Avesta","Borlänge","Falun","Gagnef","Hedemora","Leksand","Ludvika","Malung-Sälen","Mora","Orsa","Rättvik","Smedjebacken","Säter","Vansbro","Älvdalen"],
  "Gotlands län": ["Gotland"],
  "Gävleborgs län": ["Bollnäs","Gävle","Hofors","Hudiksvall","Ljusdal","Nordanstig","Ockelbo","Ovanåker","Sandviken","Söderhamn"],
  "Hallands län": ["Falkenberg","Halmstad","Hylte","Kungsbacka","Laholm","Varberg"],
  "Jämtlands län": ["Berg","Bräcke","Härjedalen","Krokom","Ragunda","Strömsund","Åre","Östersund"],
  "Jönköpings län": ["Aneby","Eksjö","Gislaved","Gnosjö","Habo","Jönköping","Mullsjö","Nässjö","Sävsjö","Tranås","Vaggeryd","Vetlanda","Värnamo"],
  "Kalmar län": ["Borgholm","Emmaboda","Hultsfred","Högsby","Kalmar","Mönsterås","Mörbylånga","Nybro","Oskarshamn","Torsås","Vimmerby","Västervik"],
  "Kronobergs län": ["Alvesta","Lessebo","Ljungby","Markaryd","Tingsryd","Uppvidinge","Växjö","Älmhult"],
  "Norrbottens län": ["Arjeplog","Arvidsjaur","Boden","Gällivare","Haparanda","Jokkmokk","Kalix","Kiruna","Luleå","Pajala","Piteå","Älvsbyn","Överkalix","Övertorneå"],
  "Skåne län": ["Bjuv","Bromölla","Burlöv","Båstad","Eslöv","Helsingborg","Hässleholm","Höganäs","Hörby","Höör","Klippan","Kristianstad","Kävlinge","Landskrona","Lomma","Lund","Malmö","Osby","Perstorp","Simrishamn","Sjöbo","Skurup","Staffanstorp","Svalöv","Svedala","Tomelilla","Trelleborg","Vellinge","Ystad","Åstorp","Ängelholm","Örkelljunga","Östra Göinge"],
  "Stockholms län": ["Botkyrka","Danderyd","Ekerö","Haninge","Huddinge","Järfälla","Lidingö","Nacka","Norrtälje","Nykvarn","Nynäshamn","Salem","Sigtuna","Sollentuna","Solna","Stockholm","Sundbyberg","Södertälje","Tyresö","Täby","Upplands Väsby","Upplands-Bro","Vallentuna","Vaxholm","Värmdö","Österåker"],
  "Södermanlands län": ["Eskilstuna","Flen","Gnesta","Katrineholm","Nyköping","Oxelösund","Strängnäs","Trosa","Vingåker"],
  "Uppsala län": ["Enköping","Heby","Håbo","Knivsta","Tierp","Uppsala","Älvkarleby","Östhammar"],
  "Värmlands län": ["Arvika","Eda","Filipstad","Forshaga","Grums","Hagfors","Hammarö","Karlstad","Kil","Kristinehamn","Munkfors","Storfors","Sunne","Säffle","Torsby","Årjäng"],
  "Västerbottens län": ["Bjurholm","Dorotea","Lycksele","Malå","Nordmaling","Norsjö","Robertsfors","Skellefteå","Sorsele","Storuman","Umeå","Vilhelmina","Vindeln","Vännäs","Åsele"],
  "Västernorrlands län": ["Härnösand","Kramfors","Sollefteå","Sundsvall","Timrå","Ånge","Örnsköldsvik"],
  "Västmanlands län": ["Arboga","Fagersta","Hallstahammar","Köping","Kungsör","Norberg","Sala","Skinnskatteberg","Surahammar","Västerås"],
  "Västra Götalands län": ["Ale","Alingsås","Bengtsfors","Bollebygd","Borås","Dals-Ed","Essunga","Falköping","Färgelanda","Grästorp","Gullspång","Göteborg","Götene","Herrljunga","Hjo","Härryda","Karlsborg","Kungälv","Lerum","Lidköping","Lilla Edet","Lysekil","Mariestad","Mark","Mellerud","Munkedal","Mölndal","Orust","Partille","Skara","Skövde","Sotenäs","Stenungsund","Strömstad","Svenljunga","Tanum","Tibro","Tidaholm","Tjörn","Tranemo","Trollhättan","Töreboda","Uddevalla","Ulricehamn","Vara","Vårgårda","Vänersborg","Åmål","Öckerö"],
  "Örebro län": ["Askersund","Degerfors","Hallsberg","Hällefors","Karlskoga","Kumla","Laxå","Lekeberg","Lindesberg","Ljusnarsberg","Nora","Örebro"],
  "Östergötlands län": ["Boxholm","Finspång","Kinda","Linköping","Mjölby","Motala","Norrköping","Söderköping","Vadstena","Valdemarsvik","Ydre","Åtvidaberg","Ödeshög"]
};

// Yrkesområdena följer vad bemannings- och rekryteringsbolag faktiskt tillsätter,
// inte Arbetsförmedlingens 21 områden för hela arbetsmarknaden. De nio första är
// Kompetensföretagens egna redovisningsområden (Industri & Tillverkning, Lager &
// Logistik, IT, Administration, Ekonomi & Finans, Teknik, Försäljning &
// Kundtjänst och Hälso- & sjukvård/Omsorg, där vård och omsorg är uppdelade),
// därefter nischer med många specialiserade bolag och sist de typiska
// rekryteringsområdena. Ordningen är medveten: de vanligaste överst.
//
// Yrkena under varje område är Arbetsförmedlingens yrkesgrupper (SSYK4-nivå),
// flyttade från de gamla områdena. Yrken som branschen sällan tillsätter
// (militära yrken, naturbruk, kultur, bevakning m.fl.) har utgått. Gamla
// områdesnamn i databasen översätts i supabase/migration_nya_yrkesomraden.sql.
export const YRKESOMRADEN = {
  "Industri och tillverkning": ["Arbetsledare inom tillverkning","Bergsprängare","Bokbindare m.fl.","Finmekaniker","Fordonsmontörer","Gjutare","Glastekniker","Handpaketerare och andra fabriksarbetare","Lackerare och industrimålare","Manuella ytbehandlare, trä","Maskinoperatörer inom ytbehandling, trä","Maskinoperatörer, blekning, färgning och tvättning","Maskinoperatörer, cement-, sten- och betongvaror","Maskinoperatörer, farmaceutiska produkter","Maskinoperatörer, gummiindustri","Maskinoperatörer, kemisktekniska och fotografiska produkter","Maskinoperatörer, kvarn-, bageri- och konfektyrindustri","Maskinoperatörer, kött- och fiskberedningsindustri","Maskinoperatörer, mejeri","Maskinoperatörer, pappersvaruindustri","Maskinoperatörer, plastindustri","Maskinoperatörer, påfyllning, packning och märkning","Maskinoperatörer, ytbehandling","Maskinsnickare och maskinoperatörer, träindustri","Maskinställare och maskinoperatörer, metallarbete","Montörer, elektrisk och elektronisk utrustning","Montörer, metall-, gummi- och plastprodukter","Montörer, träprodukter","Operatörer inom sågverk, hyvleri och plywood m.m.","Prepresstekniker","Processoperatörer, papper","Processoperatörer, pappersmassa","Processoperatörer, stenkross- och malmförädling","Processövervakare, kemisk industri","Processövervakare, metallproduktion","Provsmakare och kvalitetsbedömare","Skräddare och ateljésömmerskor m.fl.","Slaktare och styckare m.fl.","Slipare m.fl.","Smeder","Stenhuggare m.fl.","Stålkonstruktionsmontörer och grovplåtsslagare","Svetsare och gasskärare","Sömmare","Tapetserare","Tryckare","Tunnplåtslagare","Valsverksoperatörer","Verktygsmakare","Övriga drifttekniker och processövervakare","Övriga maskin- och processoperatörer vid stål- och metallverk","Övriga maskinoperatörer, livsmedelsindustri m.m.","Övriga maskinoperatörer, textil-, skinn- och läderindustri","Övriga montörer","Övriga process- och maskinoperatörer"],
  "Lager, logistik och transport": ["Arbetsledare inom lager och terminal","Bangårdspersonal","Brevbärare och postterminalarbetare","Buss- och spårvagnsförare","Fartygsbefäl m.fl.","Flygledare","Hamnarbetare","Inköps- och orderassistenter","Kabinpersonal m.fl.","Lager- och terminalpersonal","Lastbilsförare m.fl.","Lokförare","Maskinbefäl","Matroser och jungmän m.fl.","Ordersamordnare m.fl.","Piloter m.fl.","Ramppersonal, flyttkarlar och varupåfyllare m.fl.","Reklamutdelare och tidningsdistributörer","Renhållnings- och återvinningsarbetare","Speditörer och transportmäklare","Taxiförare m.fl.","Transportledare och transportsamordnare","Truckförare","Tågvärdar och ombordansvariga m.fl.","Övriga bil-, motorcykel- och cykelförare"],
  "IT": ["Designer inom spel och digitala medier","Drifttekniker, IT","IT-säkerhetsspecialister","Mjukvaru- och systemutvecklare m.fl.","Nätverks- och systemtekniker m.fl.","Supporttekniker, IT","Systemadministratörer","Systemanalytiker och IT-arkitekter m.fl.","Systemförvaltare m.fl.","Systemtestare och testledare","Utvecklare inom spel och digitala media","Webbmaster och webbadministratörer","Övriga IT-specialister"],
  "Administration och kontor": ["Arkiv- och biblioteksassistenter m.fl.","Backofficepersonal m.fl.","Bibliotekarier och arkivarier","Chefssekreterare och VD-assistenter m.fl.","Gruppledare för kontorspersonal","Informatörer, kommunikatörer och PR-specialister","Kontorsreceptionister","Medicinska sekreterare, vårdadministratörer m.fl.","Planerare och utredare m.fl.","Skattehandläggare","Socialförsäkringshandläggare","Statistiker","Telefonister","Översättare, tolkar och lingvister m.fl.","Övriga handläggare","Övriga kontorsassistenter och sekreterare"],
  "Ekonomi och finans": ["Banktjänstemän","Controller","Ekonomiassistenter m.fl.","Finansanalytiker och investeringsrådgivare m.fl.","Försäkringssäljare och försäkringsrådgivare","Inkasserare och pantlånare m.fl.","Mäklare inom finans","Nationalekonomer och makroanalytiker m.fl.","Redovisningsekonomer","Revisorer m.fl.","Skadereglerare och värderare","Traders och fondförvaltare","Övriga ekonomer"],
  "Teknik och ingenjörer": ["Arbetsmiljöingenjörer, yrkes- och miljöhygieniker","Arkitekter m.fl.","Brandingenjörer och byggnadsinspektörer m.fl.","Civilingenjörsyrken inom elektroteknik","Civilingenjörsyrken inom gruvteknik och metallurgi","Civilingenjörsyrken inom kemi och kemiteknik","Civilingenjörsyrken inom logistik och produktionsplanering","Civilingenjörsyrken inom maskinteknik","Fastighetsförvaltare","Flygtekniker","GIS- och kartingenjörer","Industridesigner","Ingenjörer och tekniker inom elektroteknik","Ingenjörer och tekniker inom gruvteknik och metallurgi","Ingenjörer och tekniker inom industri, logistik och produktionsplanering","Ingenjörer och tekniker inom kemi och kemiteknik","Ingenjörer och tekniker inom maskinteknik","Kemist","Laboratorieingenjörer","Landskapsarkitekter","Lantmätare","Livsmedelsinspektör","Mikrobiolog","Miljöingenjör/Miljövårdsingenjör","Miljöinspektör","Miljösamordnare/Miljökoordinator","Planeringsarkitekter m.fl.","Säkerhetsinspektörer m.fl.","Tandtekniker och ortopedingenjörer m.fl.","Tekniker, bilddiagnostik och medicinteknisk utrustning","Övriga civilingenjörsyrken","Övriga ingenjörer och tekniker"],
  "Försäljning och kundtjänst": ["Evenemangs- och reseproducenter m.fl.","Eventsäljare och butiksdemonstratörer m.fl.","Fastighetsmäklare","Företagssäljare","Grafiska formgivare m.fl.","Guider och reseledare","Inköpare och upphandlare","Kundtjänstpersonal","Marknads- och försäljningsassistenter","Marknadsanalytiker och marknadsförare m.fl.","Marknadsundersökare och intervjuare","Resesäljare och trafikassistenter m.fl.","Telefonförsäljare m.fl.","Uthyrare","Övriga förmedlare"],
  "Hälso- och sjukvård": ["Ambulanssjuksköterskor m.fl.","Ambulanssjukvårdare","Anestesisjuksköterskor","Apotekare","Arbetsterapeuter","AT-läkare","Audionomer och logopeder","Barnmorskor","Barnsjuksköterskor","Barnsköterskor","Biomedicinsk analytiker/BMA","Dietister","Distriktssköterskor","Djursjukskötare m.fl.","Fysioterapeuter och sjukgymnaster","Företagssköterskor","Geriatriksjuksköterskor","Grundutbildade sjuksköterskor","Intensivvårdssjuksköterskor","Kiropraktorer och naprapater m.fl.","Operationssjuksköterskor","Optiker","Psykiatrisjuksköterskor","Psykologer","Psykoterapeuter","Receptarier","Röntgensjuksköterskor","Skolsköterskor","Skötare","Specialistläkare","ST-läkare","Tandhygienister","Tandläkare","Tandsköterskor","Undersköterskor, vård- och specialavdelning och mottagning","Veterinärer","Övriga läkare","Övriga specialister inom hälso- och sjukvård","Övriga specialistsjuksköterskor"],
  "Omsorg och socialt arbete": ["Behandlingsassistenter och socialpedagoger m.fl.","Biståndsbedömare m.fl.","Fritidsledare m.fl.","Kuratorer","Personliga assistenter","Socialsekreterare","Undersköterskor, hemtjänst, hemsjukvård, äldreboende och habilitering","Vårdare, boendestödjare","Vårdbiträden","Övrig vård- och omsorgspersonal","Övriga yrken inom socialt arbete"],
  "Bygg och anläggning": ["Anläggningsarbetare","Anläggningsdykare","Anläggningsmaskinförare m.fl.","Arbetsledare inom bygg, anläggning och gruva","Betongarbetare","Brunnsborrare m.fl.","Byggnads- och ventilationsplåtslagare","Civilingenjörsyrken inom bygg och anläggning","Fin-, inrednings- och möbelsnickare","Golvläggare","Grovarbetare inom bygg och anläggning","Gruv- och stenbrottsarbetare","Ingenjörer och tekniker inom bygg och anläggning","Isoleringsmontörer","Kranförare m.fl.","Kyl- och värmepumpstekniker m.fl.","Murare m.fl.","Målare","Ställningsbyggare","Takmontörer","Träarbetare, snickare m.fl.","VVS-montörer m.fl.","Övriga byggnads- och anläggningsarbetare"],
  "El, installation och underhåll": ["Distributionselektriker","Drifttekniker vid värme- och vattenverk","Elektronikreparatörer och kommunikationselektriker m.fl.","Fastighetsskötare","Flygmekaniker m.fl.","Industrielektriker","Installations- och serviceelektriker","Motorfordonsmekaniker och fordonsreparatörer","Underhållsmekaniker och maskinreparatörer","Vaktmästare m.fl.","Övriga servicearbetare"],
  "Hotell, restaurang och storkök": ["Bagare och konditorer","Bartendrar","Hotellreceptionister m.fl.","Hovmästare och servitörer","Kafé- och konditoribiträden","Kockar och kallskänkor","Köksmästare och souschefer","Pizzabagare m.fl.","Restaurang- och köksbiträden m.fl.","Storhushållsföreståndare","Städare","Städledare och husfruar"],
  "Skola och förskola": ["Barnskötare","Elevassistenter m.fl.","Fritidspedagoger","Förskollärare","Grundskollärare","Gymnasielärare","Idrottstränare och instruktörer m.fl.","Lärare i yrkesämnen","Skolassistenter m.fl.","Speciallärare och specialpedagoger m.fl.","Studie- och yrkesvägledare","Trafiklärare","Övriga pedagoger med teoretisk specialistkompetens","Övriga utbildare och instruktörer"],
  "Handel och butik": ["Apotekstekniker","Bensinstationspersonal","Butikssäljare, dagligvaror","Butikssäljare, fackhandel","Kassapersonal m.fl.","Optikerassistenter","Säljande butikschefer och avdelningschefer i butik","Torg- och marknadsförsäljare m.fl."],
  "Chefer och ledning": ["Chefer inom arkitekt- och ingenjörsverksamhet","Chefer inom bank, finans och försäkring","Chefer inom friskvård, sport och fritid","Chefer inom förskoleverksamhet","Chefer inom grund- och gymnasieskola samt vuxenutbildning","Chefer inom handel","Chefer inom hälso- och sjukvård","Chefer inom socialt och kurativt arbete","Chefer inom äldreomsorg","Chefstjänstemän i intresseorganisationer","Driftchefer inom bygg, anläggning och gruva","Ekonomi- och finanschefer","Fastighets- och förvaltningschefer","Forsknings- och utvecklingschefer","Försäljnings- och marknadschefer","Förvaltare inom skogsbruk och lantbruk m.fl.","Förvaltnings- och planeringschefer","General-, landstings- och kommundirektörer m.fl.","Hotell- och konferenschefer","Informations-, kommunikations- och PR-chefer","Inköps-, logistik- och transportchefer","IT-chefer","Personal- och HR-chefer","Produktionschefer inom tillverkning","Restaurang- och kökschefer","Verkställande direktörer m.fl.","Övriga administrations- och servicechefer","Övriga chefer inom samhällsservice","Övriga chefer inom utbildning","Övriga chefer inom övrig servicenäring"],
  "HR och personal": ["Arbetsförmedlare","Lednings- och organisationsutvecklare","Löne- och personaladministratörer","Personal- och HR-specialister"],
  "Juridik": ["Advokater","Affärs- och företagsjurister","Domare","Domstols- och juristsekreterare m.fl.","Förvaltnings- och organisationsjurister","Åklagare","Övriga jurister"],
};

// Tjänsterna ett bolag kan erbjuda, och en besökare kan filtrera på. Listan låg
// tidigare i sex kopior — tre API-routes, två formulär och filterdefinitionen —
// och en ny tjänst var därför sex ändringar, varav en glömd räckte för att
// formuläret skulle erbjuda något servern nekade. Nu importerar alla härifrån.
//
// "Hyr/Rekrytering" är hyrrekrytering: konsulten hyrs in och kan gå över till
// en anställning. Den ligger mellan bemanning och rekrytering och hade tidigare
// ingen egen plats, trots att den är en egen affär med en egen prislapp.
export const TJANSTER = [
  "Bemanning",
  "Konsultuppdrag",
  "Rekrytering",
  "Hyr/Rekrytering",
  "Interim",
  "Search",
];
export const GILTIGA_TJANSTER = new Set(TJANSTER);

// Vad tjänsterna betyder. Skillnaden mellan bemanning, konsultuppdrag och
// interim är självklar i branschen och långt ifrån självklar för den som ska
// rekrytera för första gången — väljer kunden fel i filtret får de fel bolag
// att fråga.
//
// Två varianter av varje tjänst, för att de två läsarna har olika frågor:
//   kund  — "vad innebär det här för oss?" med ett PASSAR NÄR som svarar på om
//           det är den här tjänsten de ska filtrera på.
//   bolag — "ska vi kryssa i den här?" med ett VÄLJ OM NI som beskriver vad
//           bolaget måste kunna leverera för att få stå för tjänsten.
//
// Ligger här och inte i komponenten, bredvid namnen de beskriver: en tjänst
// utan förklaring ska synas som ett hål i den här listan.
//
// Text mellan ** blir fet. Nyckelorden är det man läser när man skummar.
export const TJANSTBESKRIVNINGAR = {
  Bemanning: {
    kund: {
      betyder:
        "Ni hyr in personal till **löpande drift** — lager, produktion, vård, butik. Bemanningsföretaget är arbetsgivare, personen arbetar hos er.",
      nar: "Ni behöver folk snabbt eller tillfälligt — arbetstoppar, sjukfrånvaro, föräldraledighet.",
    },
    bolag: {
      betyder: "Ni är arbetsgivare och hyr ut personal till kundens löpande verksamhet.",
      nar: "har egna anställda som arbetar i kundens drift.",
    },
  },
  Konsultuppdrag: {
    kund: {
      betyder:
        "Ni hyr in en **tjänsteman eller specialist** för ett avgränsat uppdrag — ekonomi, IT, HR, teknik, marknad. Konsulten är anställd hos leverantören.",
      nar: "Ni saknar en kompetens internt, för ett projekt eller en period.",
    },
    bolag: {
      betyder: "Ni hyr ut konsulter i tjänstemannaroller, på uppdrag snarare än på skift.",
      nar: "har egna specialister inom tjänstemannayrken att sätta på uppdrag.",
    },
  },
  Rekrytering: {
    kund: {
      betyder: "Bolaget hittar och presenterar kandidater. **Ni anställer** den ni väljer.",
      nar: "Ni ska tillsätta en tjänst permanent.",
    },
    bolag: {
      betyder: "Ni hittar och presenterar kandidater — kunden anställer dem själv.",
      nar: "tar uppdrag där anställningen hamnar hos kunden.",
    },
  },
  "Hyr/Rekrytering": {
    kund: {
      betyder: "Börjar som bemanning. Efter en tid — **ofta sex månader** — kan ni ta över anställningen.",
      nar: "Ni vill prova samarbetet innan ni anställer.",
    },
    bolag: {
      betyder: "Uppdraget börjar som bemanning, och kunden kan ta över anställningen efter en tid.",
      nar: "har övergång till anställning inskriven i era avtal.",
    },
  },
  Interim: {
    kund: {
      betyder: "En erfaren chef eller specialist hyrs in för en **bestämd period**.",
      nar: "En nyckelroll står tom, eller ett projekt behöver ledas i mål.",
    },
    bolag: {
      betyder: "Ni tillsätter en erfaren chef eller specialist under en avgränsad period.",
      nar: "har seniora konsulter för tillfälliga nyckelroller.",
    },
  },
  Search: {
    kund: {
      betyder: "Bolaget söker aktivt upp och kontaktar rätt personer — **även de som inte söker jobb**.",
      nar: "Rollen är senior eller svår att tillsätta.",
    },
    bolag: {
      betyder: "Ni arbetar uppsökande och kontaktar kandidater som inte själva söker.",
      nar: "gör riktade sökningar efter seniora eller svårtillsatta roller.",
    },
  },
};

export const FILTER_DEFS = {
  focus:{ label:"Fokusområde", options:Object.keys(YRKESOMRADEN) },
  service:{ label:"Tjänst", options:TJANSTER },
  sizeBand:{ label:"Storlek (medarbetare)", options:["Litet","Medel","Stort"] }
};
