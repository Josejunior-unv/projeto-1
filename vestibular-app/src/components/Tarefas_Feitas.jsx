import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Calendar,
  User,
  Download,
  FileText,
  PlayCircle,
  Link2,
  Inbox,
} from "lucide-react";
import { supabase } from "../SUPABASE";
import { MATERIAS, TIPOS_MATERIAL, coresDe } from "../constants/materias";
import { listarMateriais } from "./materiaisService";
import {
  carregarConcluidas,
  definirConcluida,
} from "./tarefasStatusService";
import { usePersistedState } from "../hooks/usePersistedState";
import { Botao, Selo, EstadoVazio, Esqueleto, BarraProgresso, CabecalhoPagina } from "./ui";
import { cx } from "./ui/cx";

const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const infoMateria = (nome) =>
  MATERIAS.find((m) => m.nome === nome) || { nome, icone: "📚", cor: "blue" };
const infoTipo = (id) =>
  TIPOS_MATERIAL.find((t) => t.id === id) || { label: "Material", icone: "📎" };

// Ícones estáticos por tipo (fora do render).
const ICONE_ACAO = { pdf: FileText, video: PlayCircle, link: Link2 };
const TEXTO_ACAO = {
  pdf: "Abrir PDF",
  video: "Assistir vídeo",
  link: "Abrir link",
};

export default function TarefasFeitas({ userId }) {
  const [materiais, setMateriais] = useState([]);
  const [concluidas, setConcluidas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [materiaAberta, setMateriaAberta] = usePersistedState(
    "tarefas_materiaAberta",
    null,
  );

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const [{ data }, mapaConcluidas] = await Promise.all([
        listarMateriais(),
        carregarConcluidas(userId),
      ]);
      if (!ativo) return;
      setMateriais(data);
      setConcluidas(mapaConcluidas);
      setCarregando(false);
    }
    carregar();

    const canal = supabase
      .channel("tarefas_materiais")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "materiais_estudo" },
        (payload) => setMateriais((prev) => [payload.new, ...prev]),
      )
      .subscribe();

    return () => {
      ativo = false;
      if (canal && typeof canal.unsubscribe === "function") canal.unsubscribe();
      else if (canal) supabase.removeChannel?.(canal);
    };
  }, [userId]);

  async function alternarConclusao(id) {
    const novo = !concluidas[id];
    setConcluidas((prev) => {
      const p = { ...prev };
      if (novo) p[id] = true;
      else delete p[id];
      return p;
    });
    await definirConcluida(userId, id, novo);
  }

  // Agrega materiais por matéria (contagens, progresso, última atualização).
  const porMateria = useMemo(() => {
    const mapa = {};
    materiais.forEach((m) => {
      if (!mapa[m.materia])
        mapa[m.materia] = { total: 0, feitas: 0, ultima: null, itens: [] };
      const g = mapa[m.materia];
      g.total++;
      if (concluidas[m.id]) g.feitas++;
      if (!g.ultima || m.criado_em > g.ultima) g.ultima = m.criado_em;
      g.itens.push(m);
    });
    return mapa;
  }, [materiais, concluidas]);

  const pastas = useMemo(
    () => MATERIAS.filter((m) => porMateria[m.nome]),
    [porMateria],
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <CabecalhoPagina
        titulo="Minhas Tarefas"
        descricao={
          materiaAberta
            ? "Marque cada item conforme for concluindo."
            : "Escolha uma matéria para ver seus materiais e tarefas."
        }
        className="mb-6"
      />

      {/* SKELETON */}
      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Esqueleto key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : pastas.length === 0 ? (
        <EstadoVazio
          icone={Inbox}
          titulo="Nenhuma tarefa por aqui"
          descricao="Quando um professor publicar um material, ele aparece aqui."
        />
      ) : (
        <AnimatePresence mode="wait">
          {!materiaAberta ? (
            /* ===== VISÃO DE PASTAS ===== */
            <motion.div
              key="pastas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {pastas.map((m, index) => {
                const g = porMateria[m.nome];
                const c = coresDe(m.cor);
                const pct = g.total ? Math.round((g.feitas / g.total) * 100) : 0;
                return (
                  <motion.button
                    key={m.nome}
                    onClick={() => setMateriaAberta(m.nome)}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index * 0.04, 0.3) }}
                    whileTap={{ scale: 0.97 }}
                    className={cx(
                      "group relative overflow-hidden text-left p-5 rounded-3xl bg-ink-900 border shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1",
                      c.borda,
                      c.hover,
                    )}
                  >
                    {/* brilho no hover */}
                    <div
                      className={cx(
                        "absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                        c.fundo,
                      )}
                    />
                    <div className="relative">
                      <div
                        className={cx(
                          "w-13 h-13 p-3 mb-4 inline-flex items-center justify-center rounded-2xl text-2xl transition-transform duration-300 group-hover:scale-110",
                          c.fundo,
                        )}
                      >
                        {m.icone}
                      </div>
                      <h3 className="font-bold text-white text-lg leading-tight">
                        {m.nome}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-ink-400">
                          {g.total} {g.total === 1 ? "item" : "itens"}
                        </span>
                        <span className="text-ink-600">·</span>
                        <span className={cx("font-bold tabular-nums", c.texto)}>
                          {pct}%
                        </span>
                      </div>
                      <BarraProgresso
                        valor={pct}
                        cor="bg-emerald-400"
                        className="mt-3"
                      />
                      <p className="text-[11px] text-ink-500 mt-2 tabular-nums">
                        {g.feitas}/{g.total} · {formatarData(g.ultima)}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            /* ===== VISÃO DENTRO DA MATÉRIA ===== */
            <motion.div
              key="itens"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => setMateriaAberta(null)}
                className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
              >
                <ArrowLeft size={16} /> Voltar às matérias
              </button>

              {(() => {
                const g = porMateria[materiaAberta];
                const mat = infoMateria(materiaAberta);
                const c = coresDe(mat.cor);
                if (!g) return null;
                return (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                      <span
                        className={cx(
                          "w-12 h-12 flex items-center justify-center rounded-2xl text-2xl",
                          c.fundo,
                        )}
                      >
                        {mat.icone}
                      </span>
                      <div>
                        <h3 className="text-xl font-black text-white">
                          {materiaAberta}
                        </h3>
                        <p className="text-xs text-ink-500 tabular-nums">
                          {g.feitas}/{g.total} concluído
                          {g.feitas === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {g.itens.map((m) => {
                        const tipo = infoTipo(m.tipo);
                        const feita = !!concluidas[m.id];
                        const IconeAcao = ICONE_ACAO[m.tipo];
                        const temLink = !!m.url_arquivo;
                        return (
                          <motion.li
                            key={m.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cx(
                              "p-4 sm:p-5 rounded-2xl border transition-all",
                              feita
                                ? "bg-emerald-500/[0.04] border-emerald-500/30"
                                : "bg-ink-900 border-white/[0.06] hover:border-white/[0.12]",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <button
                                onClick={() => alternarConclusao(m.id)}
                                aria-pressed={feita}
                                title={
                                  feita ? "Marcar como pendente" : "Concluir"
                                }
                                className={cx(
                                  "mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all active:scale-90",
                                  feita
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-ink-600 hover:border-emerald-400",
                                )}
                              >
                                {feita && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </motion.span>
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4
                                    className={cx(
                                      "font-bold",
                                      feita
                                        ? "text-ink-400 line-through"
                                        : "text-white",
                                    )}
                                  >
                                    {m.titulo}
                                  </h4>
                                  <Selo className="uppercase text-[10px]">
                                    {tipo.label}
                                  </Selo>
                                </div>

                                {m.descricao && (
                                  <p className="text-sm text-ink-400 mt-1 leading-6">
                                    {m.descricao}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-ink-500">
                                  {m.professor_nome && (
                                    <span className="inline-flex items-center gap-1 capitalize">
                                      <User size={12} /> {m.professor_nome}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} />{" "}
                                    {formatarData(m.criado_em)}
                                  </span>
                                </div>

                                {temLink && (
                                  <div className="flex items-center gap-2 flex-wrap mt-3">
                                    {IconeAcao && (
                                      <Botao
                                        as="a"
                                        href={m.url_arquivo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variante="secundario"
                                        tamanho="sm"
                                      >
                                        <IconeAcao size={14} />
                                        {TEXTO_ACAO[m.tipo]}
                                      </Botao>
                                    )}
                                    {m.tipo === "pdf" && (
                                      <Botao
                                        as="a"
                                        href={m.url_arquivo}
                                        download={m.arquivo_nome || true}
                                        variante="fantasma"
                                        tamanho="sm"
                                      >
                                        <Download size={14} /> Baixar
                                      </Botao>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
