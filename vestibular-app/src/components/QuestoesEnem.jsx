import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buscarTodasQuestoesDoAno } from "./enemService.js";
import { registrarRespostaEnem } from "./estatisticas.js";
import { usePersistedState } from "../hooks/usePersistedState";
import QuestaoCard from "./questoes/QuestaoCard.jsx";
import {
  idQuestao,
  nomeMateria,
  FILTROS,
  FILTROS_DIFICULDADE,
  DIFICULDADES,
  mapaDificuldade,
} from "./questoes/questoesUtils.js";

// Anos de prova disponíveis na API oficial do ENEM (mais recente primeiro).
const ANOS_DISPONIVEIS = [
  2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011,
  2010, 2009,
];
const ANO_PADRAO = 2020;

// Persistência local das respostas: mantém o progresso do usuário mesmo após
// fechar/atualizar o navegador e evita recontabilizar a mesma questão.
const STORAGE_PREFIXO = "enem_respostas";
const chaveStorage = (userId) => `${STORAGE_PREFIXO}_${userId || "anon"}`;

function carregarRespostasLocais(userId) {
  try {
    return JSON.parse(localStorage.getItem(chaveStorage(userId))) || {};
  } catch {
    return {};
  }
}

// Ícone de seta reutilizado nos botões de navegação.
const Seta = ({ direcao = "direita" }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={direcao === "esquerda" ? "" : "rotate-180"}
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

function SkeletonQuestao() {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-7 animate-pulse">
      <div className="flex gap-3 mb-6">
        <div className="h-6 w-20 bg-gray-800 rounded-lg" />
        <div className="h-6 w-28 bg-gray-800 rounded-lg" />
      </div>
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-gray-800 rounded w-full" />
        <div className="h-3 bg-gray-800 rounded w-11/12" />
        <div className="h-3 bg-gray-800 rounded w-9/12" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-800/70 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function QuestoesEnem({ userId }) {
  const [questoes, setQuestoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [respostasUsuario, setRespostasUsuario] = useState(() =>
    carregarRespostasLocais(userId),
  );
  const [filtroAtivo, setFiltroAtivo] = usePersistedState("enem_area", "todas");
  const [dificuldadeAtiva, setDificuldadeAtiva] = usePersistedState(
    "enem_dif",
    "todas",
  );
  const [busca, setBusca] = usePersistedState("enem_busca", "");
  const [ano, setAno] = usePersistedState("enem_ano", ANO_PADRAO);
  const [indice, setIndice] = usePersistedState("enem_indice", 0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [revisao, setRevisao] = useState(false);
  const anoAnteriorRef = useRef(ano);
  const topoRef = useRef(null);
  const primeiraRenderRef = useRef(true);
  const [direcao, setDirecao] = useState(1); // 1 = avançar, -1 = voltar

  // Busca as questões do ano selecionado (recarrega ao trocar de ano).
  useEffect(() => {
    let ativo = true;

    async function iniciarCarga() {
      setCarregando(true);
      const dadosApi = await buscarTodasQuestoesDoAno(ano);
      if (!ativo) return;
      setQuestoes(dadosApi);
      // Só limpa filtros/posição quando o ANO muda de fato — na restauração
      // inicial (mesmo ano salvo) mantém tudo que o usuário deixou.
      if (anoAnteriorRef.current !== ano) {
        setFiltroAtivo("todas");
        setDificuldadeAtiva("todas");
        setBusca("");
        setIndice(0);
      }
      anoAnteriorRef.current = ano;
      setCarregando(false);
    }

    iniciarCarga();
    return () => {
      ativo = false;
    };
    // Setters do usePersistedState/useState são estáveis — o efeito só deve
    // rodar quando o ANO muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  // Salva o progresso localmente a cada nova resposta.
  useEffect(() => {
    try {
      localStorage.setItem(
        chaveStorage(userId),
        JSON.stringify(respostasUsuario),
      );
    } catch {
      // Ignora falhas de escrita (ex.: cota do localStorage cheia).
    }
  }, [respostasUsuario, userId]);

  const dificuldadePorId = useMemo(
    () => mapaDificuldade(questoes),
    [questoes],
  );

  // Contagem de questões por área (respeitando o filtro de dificuldade atual).
  const contagens = useMemo(() => {
    const base =
      dificuldadeAtiva === "todas"
        ? questoes
        : questoes.filter(
            (q) => dificuldadePorId[idQuestao(q)] === dificuldadeAtiva,
          );
    const total = {};
    FILTROS.forEach((f) => {
      total[f.id] = base.filter((q) => f.testar(q)).length;
    });
    return total;
  }, [questoes, dificuldadeAtiva, dificuldadePorId]);

  // Lista final filtrada por área, dificuldade E busca textual.
  const questoesFiltradas = useMemo(() => {
    const fArea = FILTROS.find((f) => f.id === filtroAtivo) || FILTROS[0];
    const termo = busca.trim().toLowerCase();
    return questoes.filter((q) => {
      if (!fArea.testar(q)) return false;
      if (
        dificuldadeAtiva !== "todas" &&
        dificuldadePorId[idQuestao(q)] !== dificuldadeAtiva
      )
        return false;
      if (termo) {
        const alvo =
          `${q.context || ""} ${nomeMateria(q)} questão ${q.index}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [questoes, filtroAtivo, dificuldadeAtiva, dificuldadePorId, busca]);

  // Mantém o índice sempre dentro dos limites da lista filtrada.
  const total = questoesFiltradas.length;
  const indiceAtual = total === 0 ? 0 : Math.min(indice, total - 1);
  const questaoAtual = questoesFiltradas[indiceAtual] || null;

  // Progresso do usuário considerando a lista filtrada atual.
  const progresso = useMemo(() => {
    let respondidas = 0;
    let acertos = 0;
    questoesFiltradas.forEach((q) => {
      const r = respostasUsuario[idQuestao(q)];
      if (r) {
        respondidas++;
        if (r === q.correctAlternative) acertos++;
      }
    });
    const denom = total || 1;
    return {
      respondidas,
      acertos,
      erros: respondidas - acertos,
      total,
      pctFeito: Math.round((respondidas / denom) * 100),
      pctAcerto: respondidas ? Math.round((acertos / respondidas) * 100) : 0,
    };
  }, [questoesFiltradas, respostasUsuario, total]);

  // Ao trocar de questão, traz o topo do bloco para a área visível de forma
  // suave — sem "pular" a página inteira. Ignora a primeira renderização.
  useEffect(() => {
    if (primeiraRenderRef.current) {
      primeiraRenderRef.current = false;
      return;
    }
    topoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [indiceAtual]);

  const irPara = useCallback(
    (novo) => {
      setDirecao(novo > indiceAtual ? 1 : -1);
      setIndice(Math.max(0, Math.min(novo, total - 1)));
      setRevisao(false);
    },
    [indiceAtual, total, setIndice],
  );

  const proxima = useCallback(() => {
    if (indiceAtual < total - 1) irPara(indiceAtual + 1);
  }, [indiceAtual, total, irPara]);

  const anterior = useCallback(() => {
    if (indiceAtual > 0) irPara(indiceAtual - 1);
  }, [indiceAtual, irPara]);

  const responderQuestao = useCallback(
    (alternativa) => {
      if (!questaoAtual) return;
      const questaoId = idQuestao(questaoAtual);
      if (respostasUsuario[questaoId]) return;

      setRespostasUsuario((prev) => ({ ...prev, [questaoId]: alternativa }));

      const acertou = alternativa === questaoAtual.correctAlternative;
      if (userId) {
        registrarRespostaEnem(
          userId,
          acertou,
          nomeMateria(questaoAtual),
        ).catch(() => {
          // Falha ao salvar não deve quebrar a resolução da questão.
        });
      }
    },
    [questaoAtual, respostasUsuario, userId],
  );

  // Navegação e resposta por teclado (setas + letras A–E).
  useEffect(() => {
    function onKey(e) {
      if (e.target.matches?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") proxima();
      else if (e.key === "ArrowLeft") anterior();
      else if (/^[a-eA-E]$/.test(e.key) && questaoAtual) {
        const letra = e.key.toUpperCase();
        const existe = (questaoAtual.alternatives || []).some(
          (a) => a.letter === letra,
        );
        if (existe && !respostasUsuario[idQuestao(questaoAtual)]) {
          responderQuestao(letra);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proxima, anterior, responderQuestao, questaoAtual, respostasUsuario]);

  const trocarFiltro = (setter, valor) => {
    setter(valor);
    setIndice(0);
  };

  if (carregando) {
    return (
      <div className="mt-8 flex flex-col gap-8">
        <SkeletonQuestao />
      </div>
    );
  }

  const respostaAtual = questaoAtual
    ? respostasUsuario[idQuestao(questaoAtual)]
    : undefined;
  const difAtual = questaoAtual
    ? DIFICULDADES[dificuldadePorId[idQuestao(questaoAtual)]]
    : null;

  return (
    <div className="mt-6" ref={topoRef}>
      {/* HUD — indicadores + progresso (fica fixo no topo ao rolar) */}
      <div className="sticky top-0 z-20 -mx-2 px-2 pt-2 pb-3 bg-gray-950/90 backdrop-blur-md">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-900/40 border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white">
                Questão {total === 0 ? 0 : indiceAtual + 1}
                <span className="text-gray-500 font-bold"> de {total}</span>
              </span>
              {questaoAtual && (
                <>
                  <span className="text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                    {nomeMateria(questaoAtual)}
                  </span>
                  {difAtual && (
                    <span
                      className={`text-xs font-semibold bg-gray-800/60 border border-gray-700 px-2.5 py-1 rounded-lg ${difAtual.cor}`}
                    >
                      {difAtual.icone} {difAtual.label}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-black text-emerald-400 leading-none">
                  {progresso.acertos}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Acertos
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-rose-400 leading-none">
                  {progresso.erros}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Erros
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-cyan-400 leading-none">
                  {progresso.pctAcerto}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Aprov.
                </p>
              </div>
            </div>
          </div>

          {/* Barra de progresso (respondidas / total) */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progresso.pctFeito}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 15 }}
            />
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={() => setFiltrosAbertos((v) => !v)}
              className="text-xs font-semibold text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-blue-500/50 px-3 py-1.5 rounded-lg transition active:scale-95"
            >
              ⚙️ Filtros {filtrosAbertos ? "▲" : "▼"}
            </button>
            <button
              type="button"
              onClick={() => setRevisao((v) => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition active:scale-95 ${
                revisao
                  ? "bg-blue-600 text-white border-blue-500"
                  : "text-gray-300 bg-gray-800/60 border-gray-700 hover:border-blue-500/50"
              }`}
            >
              🧭 Revisar respostas
            </button>
          </div>
        </div>

        {/* FILTROS (recolhíveis) */}
        <AnimatePresence>
          {filtrosAbertos && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-4 rounded-2xl bg-gray-900/70 border border-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <span className="text-sm font-bold text-gray-200">
                    Filtrar por área
                  </span>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-semibold">📅 Prova:</span>
                    <select
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      className="bg-gray-800 border border-gray-700 text-gray-100 text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {ANOS_DISPONIVEIS.map((a) => (
                        <option key={a} value={a}>
                          ENEM {a}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="relative mb-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    🔍
                  </span>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setIndice(0);
                    }}
                    placeholder="Pesquisar no enunciado, matéria ou nº..."
                    className="w-full bg-gray-900/70 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {FILTROS.map((filtro) => {
                    const ativo = filtroAtivo === filtro.id;
                    const qtd = contagens[filtro.id] ?? 0;
                    const desabilitado = filtro.id !== "todas" && qtd === 0;
                    return (
                      <button
                        key={filtro.id}
                        type="button"
                        disabled={desabilitado}
                        onClick={() => trocarFiltro(setFiltroAtivo, filtro.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          ativo
                            ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30"
                            : desabilitado
                              ? "bg-gray-900/40 text-gray-600 border-gray-800 cursor-not-allowed"
                              : "bg-gray-800/40 text-gray-300 border-gray-700/60 hover:border-blue-500/50 hover:text-white"
                        }`}
                      >
                        <span>{filtro.icone}</span>
                        <span>{filtro.label}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            ativo
                              ? "bg-white/20 text-white"
                              : "bg-gray-900 text-gray-400"
                          }`}
                        >
                          {qtd}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-500 font-semibold">
                    Dificuldade (estimada):
                  </span>
                  {FILTROS_DIFICULDADE.map((d) => {
                    const ativo = dificuldadeAtiva === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => trocarFiltro(setDificuldadeAtiva, d.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                          ativo
                            ? "bg-slate-100 text-slate-900 border-slate-100"
                            : "bg-gray-800/40 text-gray-300 border-gray-700/60 hover:border-slate-400/50 hover:text-white"
                        }`}
                      >
                        <span>{d.icone}</span>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PAINEL DE REVISÃO (grade com o status de cada questão) */}
      <AnimatePresence>
        {revisao && total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-4 p-4 rounded-2xl bg-gray-900/70 border border-gray-800"
          >
            <p className="text-xs text-gray-400 mb-3 font-semibold">
              Toque em uma questão para ir até ela. Verde = acertou · Vermelho =
              errou · Cinza = não respondida.
            </p>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
              {questoesFiltradas.map((q, i) => {
                const r = respostasUsuario[idQuestao(q)];
                const acertou = r === q.correctAlternative;
                const atual = i === indiceAtual;
                let cor =
                  "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500";
                if (r)
                  cor = acertou
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40";
                return (
                  <button
                    key={idQuestao(q)}
                    type="button"
                    onClick={() => irPara(i)}
                    className={`aspect-square rounded-lg text-xs font-bold border transition-all active:scale-90 ${cor} ${
                      atual ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900" : ""
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVEGADOR DE QUESTÃO */}
      {total === 0 ? (
        <div className="mt-6 p-8 rounded-2xl border border-gray-800 bg-gray-900/50 text-center text-gray-500">
          Nenhuma questão encontrada para estes filtros.
        </div>
      ) : (
        <div className="mt-4 flex items-stretch gap-3">
          {/* Botão anterior — desktop */}
          <button
            type="button"
            onClick={anterior}
            disabled={indiceAtual === 0}
            aria-label="Questão anterior"
            className="hidden sm:flex shrink-0 w-12 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/60 text-gray-300 hover:text-white hover:border-blue-500/50 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-800"
          >
            <Seta direcao="esquerda" />
          </button>

          {/* Card com transição de deslize (troca só o conteúdo) */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <AnimatePresence mode="wait" custom={direcao}>
              <motion.div
                key={idQuestao(questaoAtual)}
                custom={direcao}
                initial={{ opacity: 0, x: direcao * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direcao * -40 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <QuestaoCard
                  questao={questaoAtual}
                  resposta={respostaAtual}
                  onResponder={respostaAtual ? undefined : responderQuestao}
                  revelar={!!respostaAtual}
                  dificuldade={dificuldadePorId[idQuestao(questaoAtual)]}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Botão próxima — desktop */}
          <button
            type="button"
            onClick={proxima}
            disabled={indiceAtual >= total - 1}
            aria-label="Próxima questão"
            className="hidden sm:flex shrink-0 w-12 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900/60 text-gray-300 hover:text-white hover:border-blue-500/50 hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-gray-800"
          >
            <Seta direcao="direita" />
          </button>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR (mobile + ações) */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={anterior}
            disabled={indiceAtual === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-700 bg-gray-800/50 text-gray-200 hover:border-blue-500/50 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Seta direcao="esquerda" /> Anterior
          </button>

          <button
            type="button"
            onClick={proxima}
            disabled={indiceAtual >= total - 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Pular sem responder"
          >
            Pular ⏭
          </button>

          <button
            type="button"
            onClick={proxima}
            disabled={indiceAtual >= total - 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-blue-500 bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Próxima <Seta direcao="direita" />
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-gray-600">
        Dica: use as setas ← → do teclado para navegar e as letras A–E para
        responder.
      </p>
    </div>
  );
}

export default QuestoesEnem;
