// Det Mina sidor visar när kontot inte är redo att administrera ett bolag.
// Samma besked oavsett vilken flik man försökte nå, så att en sparad länk till
// en förfrågan inte ger ett annat svar än /mina-sidor.
export default function MinaSidorStatus({ tillstand }) {
  const text = {
    saknas: "Vi hittar ingen bolagskoppling för det här kontot. Kontakta info@recruitable.se.",
    granskas: "Ert konto väntar fortfarande på godkännande. Vi hör av oss så snart det är klart.",
    okopplad: "Ert konto är godkänt men ännu inte kopplat till ett bolag. Kontakta info@recruitable.se.",
  }[tillstand];

  return (
    <div style={{ maxWidth: 640, margin: "60px auto", padding: "0 24px" }}>
      <p>{text}</p>
    </div>
  );
}
