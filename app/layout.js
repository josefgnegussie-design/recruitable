import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Recruitable — Bemanning & rekrytering i Sverige",
  description:
    "Jämför bemannings- och rekryteringsföretag i Sverige utifrån bransch, ort, kollektivavtal och pris.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
