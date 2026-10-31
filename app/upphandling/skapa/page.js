import SkapaUpphandling from "@/components/upphandling/SkapaUpphandling";

export const metadata = {
  title: "Lägg ut en upphandling",
  description:
    "Beskriv ert behov av bemanning eller rekrytering och låt bolagen anmäla intresse.",
  alternates: { canonical: "/upphandling/skapa" },
};

export default function SkapaUpphandlingPage() {
  return <SkapaUpphandling />;
}
