import { useState } from "react";
import { motion } from "framer-motion";
import OnboardingLayout from "./OnboardingLayout";
import { materias as listaInicialMaterias, calcularCronograma } from "../logica.js";

const NIVEIS = [
  { peso: 1, label: "Fácil", cor: "bg-emerald-500 border-emerald-400" },
  { peso: 2, label: "Tranquilo", cor: "bg-teal-500 border-teal-400" },
  { peso: 3, label: "Médio", cor: "bg-amber-500 border-amber-400" },
  { peso: 4, label: "Difícil", cor: "bg-orange-500 border-orange-400" },
  { peso: 5, label: "Muito difícil", cor: "bg-rose-500 border-rose-400" },
];

// Controle deslizante estilizado (rótulo + valor + range).
function Slider({ label, valor, min, max, onChange, sufixo }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-200">{label}</label>
        <span className="text-lg font-black text-blue-400">
          {valor}
          <span className="text-xs text-gray-500 font-bold"> {sufixo}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500 cursor-pointer"
      />
    </div>
  );
}

export default function PassoConfiguracao({ onNext, onBack, inicial = {} }) {
  const [dias, setDias] = useState(inicial.dias ?? 5);
  const [horas, setHoras] = useState(inicial.horas ?? 4);
  const [pesos, setPesos] = useState(
    inicial.pesos ?? listaInicialMaterias.map((m) => ({ ...m, peso: m.peso || 1 })),
  );

  const totalSemana = dias * horas;

  const setPeso = (index, novoPeso) => {
    setPesos((prev) =>
      prev.map((m, i) => (i === index ? { ...m, peso: novoPeso } : m)),
    );
  };

  const finalizar = () => {
    const cronograma = calcularCronograma(dias, horas, pesos);
    onNext({ dias, horas, pesos, cronograma });
  };

  return (
    <OnboardingLayout
      passo={2}
      titulo="Sua rotina de estudos"
      subtitulo="Defina quanto tempo você tem e o quão desafiadora é cada matéria pra você. Quanto maior o nível, mais horas ela recebe."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <Slider label="Dias por semana" valor={dias} min={1} max={7} sufixo="dias" onChange={setDias} />
        <Slider label="Horas por dia" valor={horas} min={1} max={12} sufixo="h" onChange={setHoras} />
      </div>

      <div className="flex items-center justify-center gap-2 mb-6 text-sm">
        <span className="text-gray-400">Total semanal:</span>
        <span className="font-black text-emerald-400 text-lg">{totalSemana}h</span>
        <span className="text-gray-600">({dias} × {horas}h)</span>
      </div>

      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">
        Dificuldade por matéria
      </h3>
      <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1 mb-6">
        {pesos.map((materia, index) => (
          <div
            key={materia.nome}
            className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3.5"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-semibold text-gray-200 text-sm">{materia.nome}</span>
              <span className="text-[11px] text-gray-500 font-medium">
                {NIVEIS[materia.peso - 1]?.label}
              </span>
            </div>
            <div className="flex gap-1.5">
              {NIVEIS.map((n) => {
                const ativo = materia.peso === n.peso;
                return (
                  <button
                    key={n.peso}
                    type="button"
                    onClick={() => setPeso(index, n.peso)}
                    aria-label={`${materia.nome}: ${n.label}`}
                    className={`flex-1 h-8 rounded-lg border-2 transition-all active:scale-90 ${
                      ativo
                        ? `${n.cor} scale-105`
                        : "bg-gray-800/60 border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <span className={`text-xs font-bold ${ativo ? "text-white" : "text-gray-500"}`}>
                      {n.peso}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 rounded-xl text-sm font-semibold border border-gray-700 bg-gray-800/50 text-gray-200 hover:border-gray-500 transition active:scale-95"
        >
          ← Voltar
        </button>
        <motion.button
          type="button"
          onClick={finalizar}
          whileTap={{ scale: 0.99 }}
          className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/25"
        >
          Gerar meu cronograma ✨
        </motion.button>
      </div>
    </OnboardingLayout>
  );
}
