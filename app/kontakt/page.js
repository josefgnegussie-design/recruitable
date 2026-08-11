import ContactForm from "@/components/ContactForm";

export default function KontaktPage() {
  return (
    <div id="view-kontakt">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">Kontakta oss</div>
          <h1 className="hero-title">Hör av dig</h1>
          <p className="hero-sub">Har du en fråga om Recruitable? Skriv till oss så återkommer vi snarast möjligt.</p>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <ContactForm />
      </div>
    </div>
  );
}
