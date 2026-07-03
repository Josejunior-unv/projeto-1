import { useState } from "react";
import StepVestibular from "./StepVestibular";
import StepVestibular2 from "./StepVestibular2";
import StepVestibular3 from "./StepVestibular3";

// Assistente de configuração inicial (escolha do vestibular → pesos/rotina →
// revisão e salvamento do cronograma). Encapsula os 3 passos e avisa o App
// quando o cronograma é salvo, via onConcluir().
export default function Onboarding({ onConcluir }) {
  const [step, setStep] = useState(1);
  const [dados, setDados] = useState({});

  function handleNext(info) {
    // O passo 1 envia uma string (vestibular) e o passo 2 envia um objeto
    // ({ cronograma }). Só mesclamos objetos ao estado.
    if (info && typeof info === "object") {
      setDados((prev) => ({ ...prev, ...info }));
    }
    setStep((s) => s + 1);
  }

  return (
    <>
      {step === 1 && <StepVestibular onNext={handleNext} />}
      {step === 2 && <StepVestibular2 onNext={handleNext} />}
      {step === 3 && (
        <StepVestibular3 cronograma={dados.cronograma} onSaveSuccess={onConcluir} />
      )}
    </>
  );
}
