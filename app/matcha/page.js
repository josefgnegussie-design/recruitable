"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { flowMatches } from "@/lib/helpers";
import { COMPANIES } from "@/lib/companies";
import { useSessionDraft } from "@/lib/useSessionDraft";
import Stepper from "@/components/wizard/Stepper";
import Step1Yrke from "@/components/wizard/Step1Yrke";
import Step2Ort from "@/components/wizard/Step2Ort";
import Step3Villkor from "@/components/wizard/Step3Villkor";
import Step4Uppdrag from "@/components/wizard/Step4Uppdrag";
import Step5Skicka from "@/components/wizard/Step5Skicka";
import Step6Aterkoppling from "@/components/wizard/Step6Aterkoppling";

function newFlowState(initial) {
  return {
    step: 1,
    omrade: "",
    yrke: "",
    ort: "",
    kollektivavtal: "",
    prisintervall: "",
    timdebitering: "",
    gflT: "",
    gflP: "",
    gflOvriga: "",
    gflArbetstid: "",
    gflForkortning: "",
    gflResult: null,
    faktor: "2.00",
    timdebiteringNormaltid: "",
    faktorOB: "",
    uppdragstyp: "",
    uppdragTid: "",
    startTyp: "",
    startDatum: "",
    startTid: "",
    selected: new Set(),
    sending: false,
    results: null,
    err: null,
    ...initial,
  };
}

// Set går inte att JSON-serialisera, och "skickar just nu" hör inte hemma i ett
// sparat utkast — en omladdning mitt i sändningen ska inte ge en låst knapp.
function serializeFlow(flow) {
  return { ...flow, selected: [...flow.selected], sending: false, err: null };
}

function deserializeFlow(saved) {
  return { ...saved, selected: new Set(saved.selected || []), sending: false };
}

function MatchaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramOmrade = searchParams.get("omrade") || "";
  const paramYrke = searchParams.get("yrke") || "";
  const paramStep = searchParams.get("step");

  // Hela flödet sparas per flik, så att besökaren kan gå tillbaka, ladda om eller
  // lämna sidan och komma tillbaka utan att tappa det som redan är ifyllt.
  const { state: flow, setState: setFlow, patch, restored, clearDraft } = useSessionDraft(
    "matcha",
    newFlowState({ omrade: paramOmrade, yrke: paramYrke, step: paramStep ? Number(paramStep) : 1 }),
    { serialize: serializeFlow, deserialize: deserializeFlow }
  );

  // En länk hit med yrke/område är ett medvetet nytt utgångsläge och ska väga
  // tyngre än utkastet — resten av svaren behålls.
  const appliedParams = useRef(false);
  useEffect(() => {
    if (!restored || appliedParams.current) return;
    appliedParams.current = true;
    if (paramOmrade || paramYrke) {
      patch({
        ...(paramOmrade ? { omrade: paramOmrade } : {}),
        ...(paramYrke ? { yrke: paramYrke } : {}),
        ...(paramStep ? { step: Number(paramStep) } : {}),
      });
    }
  }, [restored, paramOmrade, paramYrke, paramStep, patch]);

  function onNext() {
    if (flow.step === 3) {
      if (flow.kollektivavtal === "IF Metall" && (!flow.gflResult || !flow.timdebiteringNormaltid.trim())) {
        patch({ err: "Beräkna GFL och ange timdebitering, normaltid för att gå vidare." });
        return;
      }
      if (flow.kollektivavtal === "Unionen" && !flow.timdebitering.trim()) {
        patch({ err: "Ange timdebitering för att gå vidare." });
        return;
      }
      if (!flow.kollektivavtal && !flow.prisintervall.trim()) {
        patch({ err: "Ange ett prisintervall för att gå vidare." });
        return;
      }
    }
    if (flow.step === 4 && !flow.uppdragstyp) {
      patch({ err: "Välj en uppdragstyp för att gå vidare." });
      return;
    }
    if (flow.step === 4 && !flow.startTyp) {
      patch({ err: "Välj när uppdraget förväntas dra igång för att gå vidare." });
      return;
    }
    if (flow.step === 4) {
      const matched = flowMatches(flow.omrade, flow.ort, COMPANIES);
      setFlow((prev) => ({ ...prev, err: null, step: Math.min(6, prev.step + 1), selected: new Set(matched.map((c) => c.id)) }));
      return;
    }
    setFlow((prev) => ({ ...prev, err: null, step: Math.min(6, prev.step + 1) }));
  }

  function onBack() {
    setFlow((prev) => ({ ...prev, err: null, step: Math.max(1, prev.step - 1) }));
  }

  function onSend() {
    if (flow.selected.size === 0) {
      patch({ err: "Välj minst ett bolag att skicka förfrågan till." });
      return;
    }
    patch({ err: null, sending: true });
    setTimeout(() => {
      const list = COMPANIES.filter((c) => flow.selected.has(c.id));
      const notesYes = ["Vi är intresserade och återkommer med förslag.", "Det här passar vår verksamhet bra.", "Ja, vi vill gärna veta mer om behovet."];
      const notesNo = ["Har tyvärr inte kapacitet just nu.", "Passar inte vår nuvarande inriktning.", "Fullbokade inom den här branschen just nu."];
      const results = list.map((c) => {
        const accepted = Math.random() < 0.7;
        const notes = accepted ? notesYes : notesNo;
        return { name: c.name, accepted, note: notes[Math.floor(Math.random() * notes.length)] };
      });
      setFlow((prev) => ({ ...prev, sending: false, results, step: 6 }));
    }, 1400);
  }

  function onRestart() {
    clearDraft();
    setFlow(newFlowState());
  }

  function onExit() {
    router.push("/");
  }

  if (!restored) return null;

  return (
    <div id="view-flow">
      <div className="back-link" onClick={onExit}>&larr; Avbryt och tillbaka till startsidan</div>
      <div className="flow-wrap">
        <span className="flow-demo-badge">Demo — inget skickas på riktigt</span>
        <Stepper step={flow.step} />
        {flow.step === 1 && <Step1Yrke flow={flow} patch={patch} onNext={onNext} />}
        {flow.step === 2 && <Step2Ort flow={flow} patch={patch} onNext={onNext} onBack={onBack} />}
        {flow.step === 3 && <Step3Villkor flow={flow} patch={patch} onNext={onNext} onBack={onBack} />}
        {flow.step === 4 && <Step4Uppdrag flow={flow} patch={patch} onNext={onNext} onBack={onBack} />}
        {flow.step === 5 && <Step5Skicka flow={flow} patch={patch} onBack={onBack} onSend={onSend} />}
        {flow.step === 6 && <Step6Aterkoppling flow={flow} onRestart={onRestart} onExit={onExit} />}
      </div>
    </div>
  );
}

export default function MatchaPage() {
  return (
    <Suspense fallback={null}>
      <MatchaContent />
    </Suspense>
  );
}
