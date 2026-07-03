import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import PassoVestibular from "./onboarding/PassoVestibular";
import PassoConfiguracao from "./onboarding/PassoConfiguracao";
import PassoResumo from "./onboarding/PassoResumo";

// Assistente de configuração inicial (vestibular → rotina/pesos → resumo e
// salvamento do cronograma). Guarda os dados de cada passo em `dados`, o que
// permite voltar sem perder o que já foi preenchido.
export default function Onboarding({ onConcluir }) {
  const [step, setStep] = useState(1);
  const [dados, setDados] = useState({ vestibular: "ENEM" });

  const avancar = (info) => {
    if (info && typeof info === "object") {
      setDados((prev) => ({ ...prev, ...info }));
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const voltar = () => setStep((s) => Math.max(1, s - 1));

  return (
    <AnimatePresence mode="wait">
      {step === 1 && (
        <PassoVestibular key="p1" inicial={dados.vestibular} onNext={avancar} />
      )}
      {step === 2 && (
        <PassoConfiguracao key="p2" inicial={dados} onNext={avancar} onBack={voltar} />
      )}
      {step === 3 && (
        <PassoResumo
          key="p3"
          cronograma={dados.cronograma}
          onBack={voltar}
          onSaveSuccess={onConcluir}
        />
      )}
    </AnimatePresence>
  );
}
