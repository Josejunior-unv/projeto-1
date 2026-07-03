import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buscarTodasQuestoesDoAno, idQuestao } from "./enemService.js";
import { registrarRespostaEnem } from "./estatisticas.js";
import { usePersistedState } from "../hooks/usePersistedState";

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

// Filtros por área do conhecimento. A API do ENEM classifica cada questão em
// uma das 4 grandes áreas (`discipline`) + língua estrangeira (`language`).
const FILTROS = [
  { id: "todas", label: "Todas", icone: "🎯", testar: () => true },
  {
    id: "matematica",
    label: "Matemática",
    icone: "🔢",
    testar: (q) => q.discipline === "matematica",
  },
  {
    id: "linguagens",
    label: "Linguagens",
    icone: "📖",
    testar: (q) => q.discipline === "linguagens",
  },
  {
    id: "humanas",
    label: "Ciências Humanas",
    icone: "🌍",
    testar: (q) => q.discipline === "ciencias-humanas",
  },
  {
    id: "natureza",
    label: "Ciências da Natureza",
    icone: "🔬",
    testar: (q) => q.discipline === "ciencias-natureza",
  },
  {
    id: "ingles",
    label: "Inglês",
    icone: "🇬🇧",
    testar: (q) => q.language === "ingles",
  },
  {
    id: "espanhol",
    label: "Espanhol",
    icone: "🇪🇸",
    testar: (q) => q.language === "espanhol",
  },
];

// Dificuldade ESTIMADA (a API não informa dificuldade). Heurística baseada no
// tamanho do enunciado + alternativas + presença de imagens. É aproximada.
const DIFICULDADES = {
  facil: { label: "Fácil", icone: "🟢", cor: "text-emerald-400" },
  media: { label: "Média", icone: "🟡", cor: "text-amber-400" },
  dificil: { label: "Difícil", icone: "🔴", cor: "text-rose-400" },
};

function estimarDificuldade(q) {
  const ctx = (q.context || "").length;
  const alts = q.alternatives || [];
  const altLen = alts.reduce((s, a) => s + (a.text || "").length, 0);
  const temImagem = (q.files || []).length > 0 || alts.some((a) => a.file);
  const score = ctx + altLen + (temImagem ? 250 : 0);
  if (score < 750) return "facil";
  if (score < 1100) return "media";
  return "dificil";
}

const FILTROS_DIFICULDADE = [
  { id: "todas", label: "Todas", icone: "⚖️" },
  { id: "facil", label: "Fácil", icone: "🟢" },
  { id: "media", label: "Média", icone: "🟡" },
  { id: "dificil", label: "Difícil", icone: "🔴" },
];

// Nome amigável da matéria, usado no selo da questão e ao salvar estatísticas.
function nomeMateria(questao) {
  if (questao.language === "ingles") return "Inglês";
  if (questao.language === "espanhol") return "Espanhol";

  const mapa = {
    matematica: "Matemática",
    linguagens: "Linguagens",
    "ciencias-humanas": "Ciências Humanas",
    "ciencias-natureza": "Ciências da Natureza",
  };

  return mapa[questao.discipline] || "ENEM";
}

// Card de esqueleto exibido durante o carregamento.
function SkeletonQuestao() {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-7 animate-pulse">
      <div className="flex gap-3 mb-6">
        <div className="h-6 w-20 bg-gray-800 rounded-lg" />
        <div className="h-6 w-28 bg-gray-800 rounded-lg" />
      </div>
      <div className="h-4 w-32 bg-gray-800 rounded mb-4" />
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
  const anoAnteriorRef = useRef(ano);

  // Busca as questões do ano selecionado (recarrega ao trocar de ano).
  useEffect(() => {
    let ativo = true;

    async function iniciarCarga() {
      setCarregando(true);
      const dadosApi = await buscarTodasQuestoesDoAno(ano);
      if (!ativo) return;
      setQuestoes(dadosApi);
      // Só limpa os filtros quando o ANO muda de fato — na restauração inicial
      // (mesmo ano salvo) mantém os filtros/busca que o usuário deixou.
      if (anoAnteriorRef.current !== ano) {
        setFiltroAtivo("todas");
        setDificuldadeAtiva("todas");
        setBusca("");
      }
      anoAnteriorRef.current = ano;
      setCarregando(false);
    }

    iniciarCarga();

    return () => {
      ativo = false;
    };
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

  // Dificuldade estimada por questão — calculada uma vez por lote de questões.
  const dificuldadePorId = useMemo(() => {
    const mapa = {};
    questoes.forEach((q) => {
      mapa[idQuestao(q)] = estimarDificuldade(q);
    });
    return mapa;
  }, [questoes]);

  // Contagem de questões por área (respeitando o filtro de dificuldade atual).
  const contagens = useMemo(() => {
    const base =
      dificuldadeAtiva === "todas"
        ? questoes
        : questoes.filter((q) => dificuldadePorId[idQuestao(q)] === dificuldadeAtiva);
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

  // Progresso em tempo real do usuário no ano atual.
  const progresso = useMemo(() => {
    let respondidas = 0;
    let acertos = 0;
    questoes.forEach((q) => {
      const r = respostasUsuario[idQuestao(q)];
      if (r) {
        respondidas++;
        if (r === q.correctAlternative) acertos++;
      }
    });
    const total = questoes.length || 1;
    return {
      respondidas,
      acertos,
      erros: respondidas - acertos,
      total: questoes.length,
      pctFeito: Math.round((respondidas / total) * 100),
      pctAcerto: respondidas ? Math.round((acertos / respondidas) * 100) : 0,
    };
  }, [questoes, respostasUsuario]);

  function responderQuestao(questao, questaoId, alternativa) {
    if (respostasUsuario[questaoId]) return;

    setRespostasUsuario((prev) => ({ ...prev, [questaoId]: alternativa }));

    const acertou = alternativa === questao.correctAlternative;
    if (userId) {
      registrarRespostaEnem(userId, acertou, nomeMateria(questao)).catch(() => {
        // Falha ao salvar não deve quebrar a resolução da questão.
      });
    }
  }

  if (carregando) {
    return (
      <div className="mt-8 flex flex-col gap-8">
        <SkeletonQuestao />
        <SkeletonQuestao />
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* PAINEL DE PROGRESSO */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-900/40 border border-gray-800"
      >
        <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-2xl font-black text-white leading-none">
                {progresso.respondidas}
                <span className="text-gray-600 text-lg">/{progresso.total}</span>
              </p>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-1">
                Respondidas
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400 leading-none">
                {progresso.acertos}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-1">
                Acertos
              </p>
            </div>
            <div>
              <p className="text-2xl font-black text-rose-400 leading-none">
                {progresso.erros}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-1">
                Erros
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-none">
              {progresso.pctAcerto}%
            </p>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mt-1">
              Aproveitamento
            </p>
          </div>
        </div>
        {/* Barra de progresso animada */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progresso.pctFeito}%` }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
          />
        </div>
      </motion.div>

      {/* FILTROS */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-4 bg-gray-950/85 backdrop-blur-md border-b border-gray-800 rounded-b-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-200">
              Filtrar por área
            </span>
            <span className="text-xs text-gray-500">
              ({questoesFiltradas.length}{" "}
              {questoesFiltradas.length === 1 ? "questão" : "questões"})
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-semibold">📅 Prova:</span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-gray-100 text-sm font-semibold rounded-lg px-3 py-1.5
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {ANOS_DISPONIVEIS.map((a) => (
                <option key={a} value={a}>
                  ENEM {a}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Busca */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            🔍
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar no enunciado, matéria ou nº da questão..."
            className="w-full bg-gray-900/70 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600
                       focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((filtro) => {
            const ativo = filtroAtivo === filtro.id;
            const qtd = contagens[filtro.id] ?? 0;
            const desabilitado = filtro.id !== "todas" && qtd === 0;

            return (
              <button
                key={filtro.id}
                type="button"
                disabled={desabilitado}
                onClick={() => setFiltroAtivo(filtro.id)}
                aria-pressed={ativo}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border
                            transition-all duration-200 active:scale-95 ${
                              ativo
                                ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30"
                                : desabilitado
                                  ? "bg-gray-900/40 text-gray-600 border-gray-800 cursor-not-allowed"
                                  : "bg-gray-800/40 text-gray-300 border-gray-700/60 hover:border-blue-500/50 hover:text-white hover:bg-gray-800"
                            }`}
              >
                <span>{filtro.icone}</span>
                <span>{filtro.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    ativo ? "bg-white/20 text-white" : "bg-gray-900 text-gray-400"
                  }`}
                >
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtro de dificuldade (estimada) */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span
            className="text-[11px] text-gray-500 font-semibold"
            title="A dificuldade é uma estimativa (a API do ENEM não fornece esse dado)."
          >
            Dificuldade (estimada):
          </span>
          {FILTROS_DIFICULDADE.map((d) => {
            const ativo = dificuldadeAtiva === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDificuldadeAtiva(d.id)}
                aria-pressed={ativo}
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

      {/* LISTA DE QUESTÕES */}
      {questoesFiltradas.length === 0 ? (
        <div className="mt-8 p-8 rounded-2xl border border-gray-800 bg-gray-900/50 text-center text-gray-500">
          Nenhuma questão encontrada para estes filtros.
        </div>
      ) : (
        <div className="flex flex-col gap-8 mt-8">
          {questoesFiltradas.map((questao) => {
            const questaoId = idQuestao(questao);
            const respostaUsuario = respostasUsuario[questaoId];
            const alternativas = questao.alternatives || [];
            const dif = DIFICULDADES[dificuldadePorId[questaoId]] || null;
            const acertou = respostaUsuario === questao.correctAlternative;

            return (
              <div
                key={questaoId}
                className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-7 shadow-2xl hover:border-blue-500/30 transition-all duration-300"
              >
                {/* TOPO */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-2 flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg">
                      Questão {questao.index}
                    </span>

                    <span className="text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg">
                      {nomeMateria(questao)}
                    </span>

                    {dif && (
                      <span
                        className={`text-xs font-semibold bg-gray-800/60 border border-gray-700 px-2.5 py-1 rounded-lg ${dif.cor}`}
                        title="Dificuldade estimada"
                      >
                        {dif.icone} {dif.label}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-gray-500">{questao.year}</span>
                </div>

                {/* ENUNCIADO */}
                <div className="mb-7">
                  <h2 className="text-white text-lg font-bold mb-4">Enunciado</h2>
                  <p className="text-gray-300 text-sm leading-7 whitespace-pre-line">
                    {questao.context}
                  </p>
                </div>

                {/* IMAGENS */}
                {questao.files && questao.files.length > 0 && (
                  <div className="flex flex-col gap-4 mb-7">
                    {questao.files.map((imagem, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-xl border border-gray-700 bg-black"
                      >
                        <img
                          src={imagem}
                          alt={`Questão ${questao.index}`}
                          loading="lazy"
                          className="w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ALTERNATIVAS */}
                <div className="flex flex-col gap-4">
                  {alternativas.map((alt) => {
                    const correta = alt.letter === questao.correctAlternative;
                    const selecionada = respostaUsuario === alt.letter;

                    let estilo =
                      "bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800/70";
                    if (respostaUsuario && selecionada && !correta) {
                      estilo = "bg-red-500/10 border-red-500 text-red-300";
                    }
                    if (respostaUsuario && correta) {
                      estilo = "bg-green-500/10 border-green-500 text-green-300";
                    }

                    return (
                      <motion.button
                        key={alt.letter}
                        disabled={!!respostaUsuario}
                        whileTap={!respostaUsuario ? { scale: 0.98 } : undefined}
                        animate={
                          respostaUsuario && correta
                            ? { scale: [1, 1.015, 1] }
                            : {}
                        }
                        transition={{ duration: 0.3 }}
                        onClick={() =>
                          responderQuestao(questao, questaoId, alt.letter)
                        }
                        className={`w-full text-left p-5 rounded-xl border transition-colors duration-200 ${estilo}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="font-bold text-blue-400">
                            {alt.letter})
                          </span>
                          <span className="text-sm leading-6">{alt.text}</span>
                          {respostaUsuario && correta && (
                            <span className="ml-auto text-green-400">✓</span>
                          )}
                          {respostaUsuario && selecionada && !correta && (
                            <span className="ml-auto text-red-400">✕</span>
                          )}
                        </div>

                        {alt.file && (
                          <img
                            src={alt.file}
                            alt={`Alternativa ${alt.letter}`}
                            loading="lazy"
                            className="mt-4 rounded-lg border border-gray-700"
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* RESULTADO */}
                <AnimatePresence>
                  {respostaUsuario && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-6 pt-5 border-t border-gray-800 overflow-hidden"
                    >
                      {acertou ? (
                        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm font-semibold">
                          ✅ Você acertou a questão.
                        </div>
                      ) : (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-semibold">
                          ❌ Você errou. A resposta correta é{" "}
                          {questao.correctAlternative}.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default QuestoesEnem;
