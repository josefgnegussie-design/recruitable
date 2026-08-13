"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InquiryWizard from "@/components/inquiry/InquiryWizard";

function PartnersResultContent() {
  const searchParams = useSearchParams();

  const filters = {
    beskrivning: searchParams.get("beskrivning") || "",
    omrade: searchParams.get("omrade") || "",
    service: searchParams.get("tjanst") || "",
    sokroll: searchParams.get("sokroll") || "",
    ort: searchParams.get("ort") || "",
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
