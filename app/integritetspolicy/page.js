export default function IntegritetspolicyPage() {
  return (
    <div id="view-integritetspolicy">
      <section className="about-hero" style={{ textAlign: "left", maxWidth: 820 }}>
        <div className="l-kicker">Integritetspolicy</div>
        <h1 style={{ fontSize: "var(--text-display-md-size)" }}>Så hanterar vi personuppgifter på Recruitable</h1>
        <p className="about-hero-sub" style={{ margin: 0, maxWidth: "70ch" }}>
          Den här policyn beskriver vilken information vi samlar in när du besöker recruitable.se, varför, och
          vilka rättigheter du har. Senast uppdaterad augusti 2026.
        </p>
      </section>

      <section className="l-section" style={{ maxWidth: 820 }}>
        <h2>Personuppgiftsansvarig</h2>
        <p className="l-section-sub" style={{ margin: 0 }}>
          Recruitable är personuppgiftsansvarig för behandlingen av personuppgifter som beskrivs här. Recruitable
          är i nuläget inte ett registrerat aktiebolag — denna uppgift uppdateras med fullständiga bolagsuppgifter
          så snart ett bolag har bildats.
        </p>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Vilken information vi samlar in</h2>
        <p className="l-section-sub" style={{ marginBottom: 20 }}>
          Vad vi samlar in beror på om du bara besöker sajten, eller senare skapar ett konto som bemanningsföretag.
        </p>
        <div className="faq-list">
          <div className="faq-item">
            <p className="faq-q">Besöksstatistik (endast om du godkänner cookies)</p>
            <p className="faq-a">
              Via Google Analytics samlar vi in vilka sidor du besöker, ungefärlig plats (härledd från IP-adress),
              enhetstyp och hur du navigerar på sajten. Detta sker bara om du klickat &quot;Acceptera alla&quot; i
              cookie-bannern — väljer du &quot;Endast nödvändiga&quot; samlas ingen sådan data in.
            </p>
          </div>
          <div className="faq-item">
            <p className="faq-q">Kontouppgifter (när inloggning för bolag införs)</p>
            <p className="faq-a">
              Namn, e-postadress och företagstillhörighet för den person som administrerar ett bolags profil.
              Betalningsuppgifter hanteras direkt av Stripe — vi lagrar aldrig kortuppgifter själva.
            </p>
          </div>
          <div className="faq-item">
            <p className="faq-q">Uppgifter du själv skickar till oss</p>
            <p className="faq-a">
              Om du kontaktar oss via e-post (t.ex. för att bli listad i registret) sparar vi det du skickar in för
              att kunna svara.
            </p>
          </div>
        </div>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Varför vi samlar in det</h2>
        <p className="l-section-sub" style={{ margin: 0 }}>
          För att förstå hur sajten används och kunna förbättra den, för att kunna leverera inloggning och fakturering
          till bolag som skapar konto, samt för att kunna svara på förfrågningar som skickas till oss.
        </p>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Rättslig grund</h2>
        <p className="l-section-sub" style={{ margin: 0 }}>
          Besöksstatistik behandlas med stöd av ditt samtycke, som du kan ge eller neka via cookie-bannern och när
          som helst ändra genom att rensa dina cookies för recruitable.se. Kontouppgifter för betalande bolag
          behandlas med stöd av det avtal som ingås när ett konto skapas.
        </p>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Vilka vi delar information med</h2>
        <p className="l-section-sub" style={{ margin: 0 }}>
          Google (Google Analytics, besöksstatistik) och, när betalfunktionen är på plats, Stripe (betalningar). Vi
          säljer aldrig personuppgifter till tredje part, och delar inte information i andra syften än de som
          beskrivs här.
        </p>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Dina rättigheter</h2>
        <p className="l-section-sub" style={{ marginBottom: 12 }}>
          Enligt GDPR har du rätt att:
        </p>
        <ul style={{ color: "var(--color-body)", fontSize: 15, lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>få veta vilka uppgifter vi har om dig (registerutdrag),</li>
          <li>få felaktiga uppgifter rättade,</li>
          <li>begära att dina uppgifter raderas,</li>
          <li>invända mot eller begära begränsning av behandlingen,</li>
          <li>få ut dina uppgifter i ett maskinläsbart format (dataportabilitet), och</li>
          <li>klaga till Integritetsskyddsmyndigheten (IMY) om du anser att vi hanterar dina uppgifter felaktigt.</li>
        </ul>
      </section>

      <section className="l-section tight" style={{ maxWidth: 820 }}>
        <h2>Kontakt</h2>
        <p className="l-section-sub" style={{ margin: 0 }}>
          Har du frågor om den här policyn eller vill utöva någon av rättigheterna ovan, hör av dig till{" "}
          <a href="mailto:info@recruitable.se">info@recruitable.se</a>.
        </p>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>RECRUITABLE — BEMANNING &amp; REKRYTERING</div>
          <div>Data kontrollerad augusti 2026 · Prototyp</div>
        </div>
      </footer>
    </div>
  );
}
