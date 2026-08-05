import ResetPasswordForm from "@/components/admin/ResetPasswordForm";

export default function AterstallLosenordPage() {
  return (
    <div id="view-aterstall-losenord">
      <section className="hero" style={{ gridTemplateColumns: "1fr", maxWidth: 480, margin: "0 auto" }}>
        <div>
          <div className="eyebrow">För bolagsadmins</div>
          <h1 className="hero-title">Nytt lösenord</h1>
        </div>
      </section>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 24px 60px" }}>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
