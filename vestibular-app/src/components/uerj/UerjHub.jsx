import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FileQuestion,
  FileText,
  Timer,
  BarChart3,
  Star,
  XCircle,
  Bookmark,
  Sparkles,
  Flame,
} from "lucide-react";
import BancoQuestoesUerj from "./BancoQuestoesUerj";
import ProvasUerj from "./ProvasUerj";
import SimuladoUerj from "./SimuladoUerj";
import EstatisticasUerj from "./EstatisticasUerj";
import { resumoEstudo } from "./uerjEstudoService";
import { usePersistedState } from "../../hooks/usePersistedState";
import { Indicador } from "../ui";
import { cx } from "../ui/cx";

// Central de estudos da UERJ: banco de questões, provas completas,
// simulados, estatísticas e atalhos de revisão — tudo num só lugar.

const SECOES = [
  {
    id: "banco",
    icone: FileQuestion,
    titulo: "Banco de Questões",
    texto: "Estude questão por questão, com filtros avançados e busca",
  },
  {
    id: "provas",
    icone: FileText,
    titulo: "Provas Completas",
    texto: "Resolva edições inteiras online ou baixe os PDFs oficiais",
  },
  {
    id: "simulado",
    icone: Timer,
    titulo: "Simulados",
    texto: "Monte um simulado personalizado com questões da UERJ",
  },
  {
    id: "estatisticas",
    icone: BarChart3,
    titulo: "Estatísticas",
    texto: "Evolução, mapa de calor por assunto e histórico de estudos",
  },
];

const ATALHOS = [
  { status: "favoritas", icone: Star, label: "Favoritas" },
  { status: "erradas", icone: XCircle, label: "Erradas" },
  { status: "revisar", icone: Bookmark, label: "Para revisar" },
  { status: "nao-respondidas", icone: Sparkles, label: "Não respondidas" },
];

export default function UerjHub({ userId, onVoltar, disciplinaInicial = null }) {
  const [secao, setSecao] = usePersistedState("uerj_secao", null);
  // Aberto por uma pasta de matéria: cai direto no banco filtrado.
  const [filtrosBanco, setFiltrosBanco] = useState(
    disciplinaInicial ? { disciplina: disciplinaInicial } : null,
  );
  const resumo = useMemo(() => resumoEstudo(userId), [userId]);

  const voltarAoHub = () => {
    setSecao(null);
    setFiltrosBanco(null);
  };

  if (secao === "banco" || filtrosBanco) {
    return (
      <BancoQuestoesUerj
        userId={userId}
        filtrosIniciais={filtrosBanco || {}}
        onVoltar={voltarAoHub}
      />
    );
  }
  if (secao === "provas") return <ProvasUerj userId={userId} onVoltar={voltarAoHub} />;
  if (secao === "simulado") return <SimuladoUerj userId={userId} onVoltar={voltarAoHub} />;
  if (secao === "estatisticas")
    return <EstatisticasUerj userId={userId} onVoltar={voltarAoHub} />;

  return (
    <div className="max-w-4xl">
      {onVoltar && (
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Todas as pastas
        </button>
      )}

      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
          Central UERJ
        </h1>
        <p className="text-sm text-ink-400 mt-2 max-w-xl">
          Todas as provas da UERJ transformadas em questões interativas — e os
          PDFs oficiais sempre disponíveis.
        </p>
      </div>

      {/* RESUMO DO ALUNO */}
      {resumo.respondidas > 0 && (
        <div className="flex items-center gap-6 sm:gap-8 flex-wrap p-4 rounded-2xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-card)] mb-8">
          <Indicador valor={resumo.respondidas} rotulo="Respondidas" />
          <Indicador valor={`${resumo.taxa}%`} rotulo="Acerto" cor="text-gold-400" />
          <Indicador valor={resumo.favoritas} rotulo="Favoritas" />
          <span className="inline-flex items-center gap-1.5 ml-auto text-sm font-bold text-gold-300">
            <Flame size={16} className={resumo.sequencia > 0 ? "" : "opacity-40"} />
            {resumo.sequencia} {resumo.sequencia === 1 ? "dia" : "dias"} seguidos
          </span>
        </div>
      )}

      {/* SEÇÕES */}
      <div className="grid sm:grid-cols-2 gap-5 mb-8">
        {SECOES.map((s, i) => (
          <motion.button
            key={s.id}
            onClick={() => setSecao(s.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className="group text-left p-6 rounded-3xl bg-ink-900 border border-white/[0.08]
                       shadow-[var(--shadow-card)] transition-all duration-300
                       hover:border-gold-400/30 hover:-translate-y-1 active:scale-[0.98]"
          >
            <span className="inline-flex w-12 h-12 mb-4 rounded-2xl bg-gold-400/10 border border-gold-400/20 text-gold-400 items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <s.icone size={22} strokeWidth={1.9} />
            </span>
            <h3 className="font-display font-black text-white text-lg tracking-tight">
              {s.titulo}
            </h3>
            <p className="text-sm text-ink-400 mt-1 leading-6">{s.texto}</p>
            <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-gold-300 transition-all group-hover:gap-2.5">
              Abrir <ArrowRight size={13} />
            </span>
          </motion.button>
        ))}
      </div>

      {/* ATALHOS DE REVISÃO */}
      <p className="text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-3">
        Continue de onde parou
      </p>
      <div className="flex gap-2 flex-wrap">
        {ATALHOS.map((a) => {
          const qtd =
            a.status === "favoritas"
              ? resumo.favoritas
              : a.status === "erradas"
                ? resumo.erros
                : a.status === "revisar"
                  ? resumo.revisar
                  : null;
          return (
            <button
              key={a.status}
              onClick={() => setFiltrosBanco({ status: a.status })}
              className={cx(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95",
                "bg-white/[0.03] text-ink-300 border-white/[0.08] hover:border-gold-400/40 hover:text-white",
              )}
            >
              <a.icone size={15} />
              {a.label}
              {qtd !== null && qtd > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gold-400/15 text-gold-300 tabular-nums">
                  {qtd}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
