"use client";

import { useRouter } from "next/navigation";

const BRANCH_FOCUS = {
  industri: ["Produktion", "Verkstad"],
  logistik: ["Lager", "Logistik"],
};

export default function BranchPicker() {
  const router = useRouter();

  function handleChange(e) {
    const val = e.target.value;
    if (!val) return;
    const focus = BRANCH_FOCUS[val];
    if (focus) router.push(`/bolag?fokus=${focus.join(",")}`);
  }

  return (
    <div className="branch-picker">
      <select className="branch-select" defaultValue="" onChange={handleChange}>
        <option value="" disabled>Välj bransch…</option>
        <option value="industri">Industri — produktion &amp; verkstad</option>
        <option value="logistik">Logistik — lager &amp; logistik</option>
      </select>
    </div>
  );
}
