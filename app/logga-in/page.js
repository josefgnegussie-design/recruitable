import LoginForm from "@/components/admin/LoginForm";

export default function LoggaInPage() {
  return (
    <div id="view-logga-in">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">För bolagsadmins</div>
          <h1 className="hero-title">Logga in</h1>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <LoginForm />
      </div>
    </div>
  );
}
