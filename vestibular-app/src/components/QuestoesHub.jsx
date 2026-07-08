import { lazy, Suspense, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  GraduationCap,
  Landmark,
  Loader2,
} from "lucide-react";
import { MATERIAS, coresDe } from "../constants/materias";
import { contarQuestoesPorDisciplina } from "./questoesUerjService";
import { usePersistedState } from "../hooks/usePersistedState";
import { CabecalhoPagina, EstadoVazio, Selo } from "./ui";
import { cx } from "./ui/cx";

const QuestoesEnem = lazy(() => import("./QuestoesEnem"));
const UerjHub = lazy(() => import("./uerj/UerjHub"));
const BancoQuestoesUerj = lazy(() => import("./uerj/BancoQuestoesUerj"));

// ------------------------------------------------------------
// Hub da área de Questões: o banco oficial do ENEM em destaque
// e uma pasta por matéria com as questões da UERJ importadas
// pelo pipeline (scripts/importador_uerj). Pastas sem conteúdo
// mostram um estado vazio elegante.
// ------------------------------------------------------------

const CarregandoInterno = ({ texto }) => (
  <div className="mt-16 flex flex-col items-center gap-3 text-ink-400">
    <Loader2 size={22} className="animate-spin text-gold-400" />
    <span className="text-sm">{texto}</span>
  </div>
);

export default function QuestoesHub({ userId }) {
  // null = hub · "enem" = banco ENEM · nome de matéria = pasta aberta
  const [pasta, setPasta] = usePersistedState("questoes_pasta", null);
  const [contagens, setContagens] = useState({});
  const [totalUerj, setTotalUerj] = useState(0);

  useEffect(() => {
    let ativo = true;
    contarQuestoesPorDisciplina().then(({ contagens: c, total: t }) => {
      if (!ativo) return;
      setContagens(c);
      setTotalUerj(t);
    });
    return () => {
      ativo = false;
    };
  }, []);

  /* ---------- BANCO ENEM ---------- */
  if (pasta === "enem") {
    return (
      <div className="max-w-3xl">
        <button
          onClick={() => setPasta(null)}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Todas as pastas
        </button>
        <div className="mb-6 cursor-default">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
            Banco de Questões ENEM
          </h1>
          <p className="text-sm text-ink-400 mt-2">
            Treine com as provas oficiais — correção e estatísticas automáticas.
          </p>
        </div>
        <Suspense fallback={<CarregandoInterno texto="Carregando questões..." />}>
          <QuestoesEnem userId={userId} />
        </Suspense>
      </div>
    );
  }

  /* ---------- CENTRAL UERJ ---------- */
  if (pasta === "uerj") {
    return (
      <Suspense fallback={<CarregandoInterno texto="Abrindo a Central UERJ..." />}>
        <UerjHub userId={userId} onVoltar={() => setPasta(null)} />
      </Suspense>
    );
  }

  /* ---------- PASTA DE MATÉRIA (banco UERJ filtrado) ---------- */
  if (pasta) {
    const qtd = contagens[pasta] ?? 0;
    if (qtd === 0) {
      return (
        <div className="max-w-3xl">
          <button
            onClick={() => setPasta(null)}
            className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Todas as pastas
          </button>
          <EstadoVazio
            icone={FolderOpen}
            titulo="Nenhuma questão adicionada ainda"
            descricao={`As questões de ${pasta} aparecem aqui assim que a equipe importar as provas da UERJ. Enquanto isso, treine no banco oficial do ENEM.`}
            acao={
              <button
                onClick={() => setPasta("enem")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gold-400 text-ink-950 hover:bg-gold-300 shadow-[var(--shadow-gold)] transition-all active:scale-[0.97]"
              >
                <GraduationCap size={16} /> Treinar no banco ENEM
              </button>
            }
          />
        </div>
      );
    }
    return (
      <Suspense fallback={<CarregandoInterno texto="Abrindo as questões..." />}>
        <BancoQuestoesUerj
          userId={userId}
          filtrosIniciais={{ disciplina: pasta }}
          onVoltar={() => setPasta(null)}
        />
      </Suspense>
    );
  }

  /* ---------- HUB ---------- */
  return (
    <div className="max-w-5xl">
      <CabecalhoPagina
        titulo="Questões"
        descricao="Escolha uma pasta para treinar — o banco oficial do ENEM completo e as questões das provas da UERJ, organizadas por matéria."
      />

      {/* DESTAQUE — Central UERJ */}
      <motion.button
        type="button"
        onClick={() => setPasta("uerj")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="group relative w-full text-left overflow-hidden p-6 sm:p-8 rounded-3xl mb-5
                   bg-ink-900 border border-gold-400/40 shadow-[var(--shadow-card)]
                   transition-all duration-300 hover:border-gold-400/70 hover:-translate-y-0.5"
      >
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.1] blur-3xl pointer-events-none transition-opacity duration-300 group-hover:opacity-[0.18]"
          style={{
            background:
              "radial-gradient(circle, var(--color-gold-400) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-5 flex-wrap">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-gold-400 text-ink-950 flex items-center justify-center shadow-[var(--shadow-gold)] transition-transform duration-300 group-hover:scale-105">
            <Landmark size={26} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-black text-white tracking-tight">
                Central UERJ
              </h2>
              <Selo variante="solido">
                {totalUerj > 0 ? `${totalUerj} questões` : "Novo"}
              </Selo>
            </div>
            <p className="text-sm text-ink-400 mt-1.5 max-w-lg">
              Banco de questões interativo, provas completas para resolver
              online, simulados personalizados e os PDFs oficiais.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-300 group-hover:gap-3 transition-all">
            Abrir central <ArrowRight size={16} />
          </span>
        </div>
      </motion.button>

      {/* DESTAQUE — banco ENEM */}
      <motion.button
        type="button"
        onClick={() => setPasta("enem")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: "easeOut" }}
        className="group relative w-full text-left overflow-hidden p-6 sm:p-8 rounded-3xl mb-10
                   bg-ink-900 border border-gold-400/25 shadow-[var(--shadow-card)]
                   transition-all duration-300 hover:border-gold-400/50 hover:-translate-y-0.5"
      >
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-[0.08] blur-3xl pointer-events-none transition-opacity duration-300 group-hover:opacity-[0.14]"
          style={{
            background:
              "radial-gradient(circle, var(--color-gold-400) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-5 flex-wrap">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-gold-400 text-ink-950 flex items-center justify-center shadow-[var(--shadow-gold)] transition-transform duration-300 group-hover:scale-105">
            <GraduationCap size={26} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl font-black text-white tracking-tight">
                Banco oficial do ENEM
              </h2>
              <Selo variante="ouro">15 provas · 2009–2023</Selo>
            </div>
            <p className="text-sm text-ink-400 mt-1.5 max-w-lg">
              Milhares de questões com correção instantânea, filtros por área e
              dificuldade, e estatísticas automáticas.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-300 group-hover:gap-3 transition-all">
            Abrir banco <ArrowRight size={16} />
          </span>
        </div>
      </motion.button>

      {/* PASTAS POR MATÉRIA */}
      <p className="text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-4">
        Questões da UERJ por matéria
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <AnimatePresence initial={false}>
          {MATERIAS.map((m, i) => {
            const c = coresDe(m.cor);
            const qtd = contagens[m.nome] ?? 0;
            return (
              <motion.button
                key={m.nome}
                type="button"
                onClick={() => setPasta(m.nome)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.04, 0.35), duration: 0.3 }}
                whileTap={{ scale: 0.97 }}
                className={cx(
                  "group relative overflow-hidden text-left p-5 rounded-3xl bg-ink-900 border shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1",
                  c.borda,
                  c.hover,
                )}
              >
                <div
                  className={cx(
                    "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    c.fundo,
                  )}
                />
                <div className="relative">
                  <div
                    className={cx(
                      "w-12 h-12 mb-4 inline-flex items-center justify-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110",
                      c.fundo,
                    )}
                  >
                    {m.icone}
                  </div>
                  <h3 className="font-bold text-white leading-tight">
                    {m.nome}
                  </h3>
                  <p className="text-xs text-ink-500 mt-1 tabular-nums">
                    {qtd === 0
                      ? "Nenhuma questão adicionada"
                      : `${qtd} ${qtd === 1 ? "questão" : "questões"}`}
                  </p>
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 mt-3 text-xs font-bold transition-all group-hover:gap-2",
                      c.texto,
                    )}
                  >
                    Abrir <ArrowRight size={13} />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
