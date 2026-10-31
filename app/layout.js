import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Sidvisningar from "@/components/Sidvisningar";
import CookieConsent from "@/components/CookieConsent";

export const metadata = {
  metadataBase: new URL("https://recruitable.se"),
  // Mallen sätter varumärket sist på varje undersida, så att sidorna skiljer sig
  // redan i fliken och i sökresultatet. default är startsidans titel.
  title: {
    default: "Recruitable — Bemanning & rekrytering i Sverige",
    template: "%s — Recruitable",
  },
  description:
    "Jämför bemannings- och rekryteringsbolag i Sverige utifrån bransch, ort, kollektivavtal och pris.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <body>
        <GoogleAnalytics />
        <Sidvisningar />
        <Header />
        {children}
        <Footer />
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
