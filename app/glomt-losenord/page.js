import ForgotPasswordForm from "@/components/admin/ForgotPasswordForm";

export const metadata = {
  title: "Glömt lösenord",
  robots: { index: false, follow: false },
};

export default function GlomtLosenordPage() {
  return (
    <div id="view-glomt-losenord">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">För bolag med konto</div>
          <h1 className="hero-title">Glömt lösenord</h1>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
