import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../SUPABASE";
import OnboardingLayout from "./OnboardingLayout";

export default function PassoResumo({ cronograma, onBack, onSaveSuccess }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const lista = Array.isArray(cronograma) ? cronograma : [];

  const totalHoras = lista.reduce((s, m) => s + (parseFloat(m.horas) || 0), 0);
  const maxHoras = lista.reduce((m, x) => Math.max(m, parseFloat(x.horas) || 0), 0) || 1;

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado. Faça login novamente.");

      const { error } = await supabase.from("cronogramas").upsert(
        {
          user_id: user.id,
          dados_cronograma: lista,
          updated_at: new Date(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      onSaveSuccess();
    } catch (e) {
      setErro("Erro ao salvar cronograma: " + e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <OnboardingLayout
      passo={3}
      titulo="Seu cronograma está pronto! 🎉"
      subtitulo="Esta é a divisão ideal de horas por ciclo, calculada a partir da sua rotina e da dificuldade de cada matéria. Você pode ajustar quando quiser."
    >
      {/* Resumo em números */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-ink-900/60 border border-ink-800 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-emerald-400">{totalHoras.toFixed(1)}h</p>
          <p className="text-[11px] uppercase tracking-wider text-ink-500 font-bold mt-1">
            Total por ciclo
          </p>
        </div>
        <div className="bg-ink-900/60 border border-ink-800 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-gold-400">{lista.length}</p>
          <p className="text-[11px] uppercase tracking-wider text-ink-500 font-bold mt-1">
            Matérias
          </p>
        </div>
      </div>

      <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1 mb-6">
        {lista.map((materia, i) => {
          const horasNum = parseFloat(materia.horas) || 0;
          const pct = Math.min(100, (horasNum / maxHoras) * 100);
          return (
            <div
              key={materia.nome}
              className="bg-ink-900/50 border border-ink-800 rounded-2xl p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-ink-200">{materia.nome}</span>
                <span className="text-xs font-bold bg-gold-400/10 text-gold-300 px-3 py-1 rounded-full border border-gold-400/20">
                  {materia.horas}h
                </span>
              </div>
              <div className="w-full bg-ink-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gold-400 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {erro && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 mb-4">
          {erro}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={salvando}
          className="px-5 py-3 rounded-xl text-sm font-semibold border border-ink-700 bg-ink-800/50 text-ink-200 hover:border-ink-500 transition active:scale-95 disabled:opacity-50"
        >
          ← Ajustar
        </button>
        <motion.button
          type="button"
          onClick={salvar}
          disabled={salvando}
          whileTap={{ scale: 0.99 }}
          className="flex-1 bg-gold-400 hover:bg-gold-300 text-ink-950 font-bold py-3 rounded-xl transition-all shadow-[var(--shadow-gold)] disabled:opacity-60 disabled:cursor-wait"
        >
          {salvando ? "Salvando..." : "🚀 Salvar e ir para o painel"}
        </motion.button>
      </div>
    </OnboardingLayout>
  );
}
