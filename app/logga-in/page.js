import Link from "next/link";
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
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--color-hairline)" }}>
          <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Kan vårt bolag bli listat i registret?</h2>
          <p style={{ fontSize: 14, color: "var(--color-muted)", margin: 0 }}>
            Om ni är ett bemannings- eller rekryteringsföretag som vill bli en del av registret, hör gärna av er
            på <a href="mailto:info@recruitable.se">info@recruitable.se</a>. Alternativt{" "}
            <Link href="/for-bolag/registrera">skapa konto</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
