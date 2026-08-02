import RegisterForm from "@/components/admin/RegisterForm";

export default function RegistreraPage() {
  return (
    <div id="view-registrera">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">För bemannings- och rekryteringsföretag</div>
          <h1 className="hero-title">Begär tillgång till er profil</h1>
          <p className="hero-sub">
            Skapa ett konto för att utöka er profil med mer information om er verksamhet. Kräver en aktiv
            premium-prenumeration, och att din e-postadress matchar bolagets registrerade webbplats.
          </p>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <RegisterForm />
      </div>
    </div>
  );
}
