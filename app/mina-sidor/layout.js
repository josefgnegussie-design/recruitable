// Inloggade sidor hör inte hemma i sökresultat. Titlarna sätter varje flik själv.
export const metadata = {
  title: "Mina sidor",
  robots: { index: false, follow: false },
};

export default function MinaSidorLayout({ children }) {
  return children;
}
