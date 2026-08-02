import "./globals.css";
import Header from "@/components/Header";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export const metadata = {
  title: "Recruitable — Bemanning & rekrytering i Sverige",
  description:
    "Jämför bemannings- och rekryteringsföretag i Sverige utifrån bransch, ort, kollektivavtal och pris.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <body>
        <GoogleAnalytics />
        <Header />
        {children}
      </body>
    </html>
  );
}
