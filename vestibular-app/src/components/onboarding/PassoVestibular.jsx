import { useState } from "react";
import { motion } from "framer-motion";
import OnboardingLayout from "./OnboardingLayout";

const OPCOES = [
  {
    id: "ENEM",
    nome: "ENEM",
    icone: "🎓",
    desc: "Exame Nacional do Ensino Médio — foco em todas as áreas e redação.",
  },
  {
    id: "UERJ",
    nome: "UERJ",
    icone: "🏛️",
    desc: "Vestibular da Universidade do Estado do Rio de Janeiro.",
  },
];

export default function PassoVestibular({ onNext, inicial = "ENEM" }) {
  const [vestibular, setVestibular] = useState(inicial);

  return (
    <OnboardingLayout
      passo={1}
      titulo="Bem-vindo! 👋"
      subtitulo="Vamos montar seu plano de estudos personalizado. Acompanhe seu desempenho diário e mensal com cronogramas, estatísticas e métricas próprias. Comece escolhendo seu vestibular."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {OPCOES.map((op) => {
          const ativo = vestibular === op.id;
          return (
            <motion.button
              key={op.id}
              type="button"
              onClick={() => setVestibular(op.id)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={`relative text-left p-5 rounded-2xl border-2 transition-colors ${
                ativo
                  ? "bg-blue-600/15 border-blue-500 shadow-lg shadow-blue-600/20"
                  : "bg-gray-900/60 border-gray-800 hover:border-gray-600"
              }`}
            >
              {ativo && (
                <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                  ✓
                </span>
              )}
              <div className="text-4xl mb-3">{op.icone}</div>
              <h3 className="text-lg font-bold text-white">{op.nome}</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{op.desc}</p>
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onNext({ vestibular })}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-[0.99]"
      >
        Continuar →
      </button>
    </OnboardingLayout>
  );
}
