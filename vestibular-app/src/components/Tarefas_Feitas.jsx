import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../SUPABASE";
import { MATERIAS, TIPOS_MATERIAL, coresDe } from "../constants/materias";
import { listarMateriais } from "./materiaisService";
import {
  carregarConcluidas,
  definirConcluida,
} from "./tarefasStatusService";
import { usePersistedState } from "../hooks/usePersistedState";

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

function acaoDoTipo(tipo) {
  if (tipo === "pdf") return { texto: "Abrir PDF", icone: "📄" };
  if (tipo === "video") return { texto: "Assistir vídeo", icone: "▶" };
  if (tipo === "link") return { texto: "Abrir link", icone: "🔗" };
  return null;
}

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
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
          Minhas Tarefas
        </h2>
        <p className="text-slate-400">
          {materiaAberta
            ? "Marque cada item conforme for concluindo."
            : "Escolha uma matéria para ver seus materiais e tarefas."}
        </p>
      </div>

      {/* SKELETON */}
      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-40 rounded-3xl bg-slate-900/50 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : pastas.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-slate-800 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="text-slate-300 font-semibold">Nenhuma tarefa por aqui</p>
          <p className="text-slate-500 text-sm mt-1">
            Quando um professor publicar um material, ele aparece aqui.
          </p>
        </div>
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
                    className={`group relative overflow-hidden text-left p-5 rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border ${c.borda} ${c.hover} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/40`}
                  >
                    {/* brilho no hover */}
                    <div
                      className={`absolute -top-10 -right-10 w-24 h-24 rounded-full ${c.fundo} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-14 h-14 rounded-2xl ${c.fundo} flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300`}
                        >
                          📁
                        </div>
                        <span className="text-2xl opacity-70">{m.icone}</span>
                      </div>
                      <h3 className="font-bold text-white text-lg leading-tight">
                        {m.nome}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-slate-400">
                          {g.total} {g.total === 1 ? "item" : "itens"}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className={`font-bold ${c.texto}`}>{pct}%</span>
                      </div>
                      <div className="mt-3 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2">
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
                className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-semibold mb-5 transition"
              >
                <span>←</span> Voltar às matérias
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
                        className={`w-12 h-12 flex items-center justify-center rounded-2xl text-2xl ${c.fundo}`}
                      >
                        {mat.icone}
                      </span>
                      <div>
                        <h3 className="text-xl font-black text-white">
                          {materiaAberta}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {g.feitas}/{g.total} concluído
                          {g.feitas === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {g.itens.map((m) => {
                        const tipo = infoTipo(m.tipo);
                        const feita = !!concluidas[m.id];
                        const acao = acaoDoTipo(m.tipo);
                        const temLink = !!m.url_arquivo;
                        return (
                          <motion.li
                            key={m.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                              feita
                                ? "bg-emerald-500/[0.04] border-emerald-500/30"
                                : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <button
                                onClick={() => alternarConclusao(m.id)}
                                aria-pressed={feita}
                                title={
                                  feita ? "Marcar como pendente" : "Concluir"
                                }
                                className={`mt-0.5 w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all active:scale-90 ${
                                  feita
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-slate-600 hover:border-emerald-400"
                                }`}
                              >
                                {feita && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="text-sm font-bold"
                                  >
                                    ✓
                                  </motion.span>
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4
                                    className={`font-bold ${
                                      feita
                                        ? "text-slate-400 line-through"
                                        : "text-white"
                                    }`}
                                  >
                                    {m.titulo}
                                  </h4>
                                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                                    <span>{tipo.icone}</span>
                                    {tipo.label}
                                  </span>
                                </div>

                                {m.descricao && (
                                  <p className="text-sm text-slate-400 mt-1 leading-6">
                                    {m.descricao}
                                  </p>
                                )}

                                <div className="flex items-center gap-3 flex-wrap mt-2 text-xs text-slate-500">
                                  {m.professor_nome && (
                                    <span className="capitalize">
                                      👤 {m.professor_nome}
                                    </span>
                                  )}
                                  <span>📅 {formatarData(m.criado_em)}</span>
                                </div>

                                {temLink && (
                                  <div className="flex items-center gap-2 flex-wrap mt-3">
                                    {acao && (
                                      <a
                                        href={m.url_arquivo}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold text-white transition-all active:scale-95 ${
                                          m.tipo === "pdf"
                                            ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500"
                                            : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                                        }`}
                                      >
                                        <span>{acao.icone}</span>
                                        {acao.texto}
                                      </a>
                                    )}
                                    {m.tipo === "pdf" && (
                                      <a
                                        href={m.url_arquivo}
                                        download={m.arquivo_nome || true}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-bold border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition active:scale-95"
                                      >
                                        ⬇ Download
                                      </a>
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
