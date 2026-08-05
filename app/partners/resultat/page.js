"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InquiryWizard from "@/components/inquiry/InquiryWizard";

function PartnersResultContent() {
  const searchParams = useSearchParams();

  const filters = {
    omrade: searchParams.get("omrade") || "",
    service: searchParams.get("tjanst") || "",
    sokroll: searchParams.get("sokroll") || "",
    ort: searchParams.get("ort") || "",
    requireKa: searchParams.get("ka") === "1",
    requireAuktorisation: searchParams.get("auk") === "1",
  };

  return <InquiryWizard filters={filters} />;
}

export default function PartnersResultPage() {
  return (
    <Suspense fallback={null}>
      <PartnersResultContent />
    </Suspense>
  );
}
