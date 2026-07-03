import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buscarTodasQuestoesDoAno } from "../enemService.js";
import { registrarRespostaEnem } from "../estatisticas.js";
import { usePersistedState } from "../../hooks/usePersistedState";
import QuestaoCard from "../questoes/QuestaoCard.jsx";
import {
  idQuestao,
  nomeMateria,
  estimarDificuldade,
  FILTROS,
  FILTROS_DIFICULDADE,
} from "../questoes/questoesUtils.js";
import {
  carregarHistorico,
  salvarSimulado,
  medalhaDe,
  carregarMeta,
  salvarMeta,
  progressoMeta,
  ranking,
  resumoHistorico,
  conquistas,
  recomendacoes,
} from "./simuladosService.js";

const ANOS = [
  2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011,
  2010, 2009,
];
const QUANTIDADES = [5, 10, 20, 30, 45];
const SEGUNDOS_POR_QUESTAO = 180; // 3 min/questão no modo prova (padrão ENEM)

function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatarTempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Botão de seleção (chip) reutilizado nos filtros de configuração.
function Chip({ ativo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all active:scale-95 ${
        ativo
          ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30"
          : "bg-gray-800/40 text-gray-300 border-gray-700/60 hover:border-blue-500/50 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function Simulado({ userId }) {
  // fase: config | carregando | rodando | resultado
  const [fase, setFase] = useState("config");

  // Configuração (persistida entre sessões).
  const [area, setArea] = usePersistedState("sim_area", "todas");
  const [dificuldade, setDificuldade] = usePersistedState("sim_dif", "todas");
  const [quantidade, setQuantidade] = usePersistedState("sim_qtd", 10);
  const [ano, setAno] = usePersistedState("sim_ano", "aleatorio");
  const [modoProva, setModoProva] = usePersistedState("sim_prova", true);

  // Execução.
  const [questoes, setQuestoes] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [indice, setIndice] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [limite, setLimite] = useState(null); // null = cronômetro livre
  const [revisaoGrade, setRevisaoGrade] = useState(false);
  const [direcao, setDirecao] = useState(1);
  const [erroCarga, setErroCarga] = useState("");

  // Resultado.
  const [resultado, setResultado] = useState(null);
  const [revisarQuestoes, setRevisarQuestoes] = useState(false);

  // Dados persistidos (histórico, meta...). Carregados na montagem via
  // inicializador do useState; o histórico é atualizado ao finalizar cada
  // simulado. (Simulado é montado por aba, com o userId já disponível.)
  const [historico, setHistorico] = useState(() => carregarHistorico(userId));
  const [meta, setMeta] = useState(() => carregarMeta(userId));
  const cardTopoRef = useRef(null);

  const resumo = useMemo(() => resumoHistorico(historico), [historico]);
  const top = useMemo(() => ranking(historico), [historico]);
  const listaConquistas = useMemo(() => conquistas(historico), [historico]);
  const recs = useMemo(() => recomendacoes(historico), [historico]);
  const progMeta = useMemo(() => progressoMeta(historico, meta), [historico, meta]);

  const total = questoes.length;
  const questaoAtual = questoes[indice] || null;
  const respondidas = Object.keys(respostas).length;

  // Refs sempre com o valor mais recente — usados no cálculo do resultado para
  // evitar setState aninhado e para não recriar o cronômetro a cada resposta.
  const questoesRef = useRef(questoes);
  const respostasRef = useRef(respostas);
  useEffect(() => {
    questoesRef.current = questoes;
  }, [questoes]);
  useEffect(() => {
    respostasRef.current = respostas;
  }, [respostas]);

  async function iniciarSimulado() {
    setErroCarga("");
    setFase("carregando");

    const anoEscolhido =
      ano === "aleatorio" ? ANOS[Math.floor(Math.random() * ANOS.length)] : ano;

    let qs = await buscarTodasQuestoesDoAno(anoEscolhido);

    const fArea = FILTROS.find((f) => f.id === area) || FILTROS[0];
    qs = qs.filter(fArea.testar);
    if (dificuldade !== "todas") {
      qs = qs.filter((q) => estimarDificuldade(q) === dificuldade);
    }

    qs = embaralhar(qs).slice(0, quantidade);

    if (qs.length === 0) {
      setErroCarga(
        "Não encontramos questões para esta combinação. Tente outra área, dificuldade ou ano.",
      );
      setFase("config");
      return;
    }

    const lim = modoProva ? qs.length * SEGUNDOS_POR_QUESTAO : null;
    setQuestoes(qs);
    setRespostas({});
    setIndice(0);
    setLimite(lim);
    setSegundos(lim ?? 0);
    setRevisaoGrade(false);
    setResultado(null);
    setRevisarQuestoes(false);
    setFase("rodando");
  }

  const finalizarSimulado = useCallback(() => {
    const qsAtuais = questoesRef.current;
    const respAtuais = respostasRef.current;

    let acertos = 0;
    const porMateria = {};
    qsAtuais.forEach((q) => {
      const mat = nomeMateria(q);
      if (!porMateria[mat]) porMateria[mat] = { acertos: 0, total: 0 };
      porMateria[mat].total++;
      const r = respAtuais[idQuestao(q)];
      if (r && r === q.correctAlternative) {
        acertos++;
        porMateria[mat].acertos++;
      }
    });

    const totalQ = qsAtuais.length;
    const respond = Object.keys(respAtuais).length;
    const erros = respond - acertos;
    const emBranco = totalQ - respond;
    const pct = totalQ ? Math.round((acertos / totalQ) * 100) : 0;
    const tempoSegundos = limite != null ? limite - segundos : segundos;
    const medalha = medalhaDe(pct);

    // Comparação com o desempenho ANTERIOR (antes deste simulado).
    const resumoAntes = resumoHistorico(historico);

    const registro = {
      modo: modoProva ? "Modo prova" : "Treino",
      area,
      dificuldade,
      ano,
      totalQuestoes: totalQ,
      acertos,
      erros,
      emBranco,
      pct,
      tempoSegundos,
      medalha: medalha?.id || null,
      porMateria,
    };

    const salvo = salvarSimulado(userId, registro);
    setHistorico(carregarHistorico(userId));

    // Integra com as Estatísticas gerais: cada questão respondida é registrada
    // na mesma tabela usada pelo dashboard.
    if (userId) {
      qsAtuais.forEach((q) => {
        const r = respAtuais[idQuestao(q)];
        if (r) {
          registrarRespostaEnem(
            userId,
            r === q.correctAlternative,
            nomeMateria(q),
          ).catch(() => {});
        }
      });
    }

    setResultado({
      ...salvo,
      medalhaObj: medalha,
      porMateriaArr: Object.entries(porMateria)
        .map(([name, v]) => ({
          name,
          ...v,
          pct: v.total ? Math.round((v.acertos / v.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total),
      comparacao: {
        mediaAntes: resumoAntes.mediaPct,
        melhorAntes: resumoAntes.melhorPct,
        deltaMedia: resumoAntes.total ? pct - resumoAntes.mediaPct : null,
        recorde: resumoAntes.total > 0 && pct > resumoAntes.melhorPct,
        primeiro: resumoAntes.total === 0,
      },
    });
    setFase("resultado");
  }, [userId, area, dificuldade, ano, modoProva, limite, segundos, historico]);

  // Cronômetro: conta para baixo (modo prova) ou para cima (treino). O tempo
  // esgotado é tratado dentro do callback assíncrono (não no corpo do efeito),
  // finalizando o simulado automaticamente.
  useEffect(() => {
    if (fase !== "rodando") return undefined;
    const t = setTimeout(() => {
      if (limite != null && segundos <= 1) {
        setSegundos(0);
        finalizarSimulado();
      } else {
        setSegundos((s) => (limite != null ? s - 1 : s + 1));
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [fase, limite, segundos, finalizarSimulado]);

  // Refaz o simulado com EXATAMENTE as mesmas questões (não refetch).
  const refazer = () => {
    setRespostas({});
    setIndice(0);
    setSegundos(limite ?? 0);
    setRevisaoGrade(false);
    setResultado(null);
    setRevisarQuestoes(false);
    setDirecao(1);
    setFase("rodando");
  };

  // Navegação entre questões.
  const irPara = (novo) => {
    setDirecao(novo > indice ? 1 : -1);
    setIndice(Math.max(0, Math.min(novo, total - 1)));
    setRevisaoGrade(false);
    cardTopoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const proxima = () => indice < total - 1 && irPara(indice + 1);
  const anterior = () => indice > 0 && irPara(indice - 1);

  const responder = (letra) => {
    if (!questaoAtual) return;
    setRespostas((prev) => ({ ...prev, [idQuestao(questaoAtual)]: letra }));
  };

  const tempoBaixo = limite != null && segundos <= 60;

  /* ------------------------------- CONFIG ------------------------------- */
  if (fase === "config" || fase === "carregando") {
    const carregando = fase === "carregando";
    return (
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">
            Simulados
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monte um simulado, cronometre seu tempo e acompanhe sua evolução.
          </p>
        </div>

        {/* Meta semanal */}
        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-900/40 border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-200">Meta semanal</h3>
              <p className="text-xs text-gray-500">
                {progMeta.feitos} de {progMeta.alvo} simulados nesta semana
                {progMeta.concluida ? " · concluída! 🎉" : ""}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              Alvo:
              <select
                value={meta.simuladosPorSemana}
                onChange={(e) => {
                  const nova = { ...meta, simuladosPorSemana: Number(e.target.value) };
                  setMeta(nova);
                  salvarMeta(userId, nova);
                }}
                className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {[1, 2, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}/semana
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progMeta.pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Configuração do simulado */}
        <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 mb-6">
          <h3 className="text-lg font-bold text-white mb-5">Novo simulado</h3>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Área
              </p>
              <div className="flex flex-wrap gap-2">
                {FILTROS.map((f) => (
                  <Chip key={f.id} ativo={area === f.id} onClick={() => setArea(f.id)}>
                    {f.icone} {f.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Dificuldade (estimada)
              </p>
              <div className="flex flex-wrap gap-2">
                {FILTROS_DIFICULDADE.map((d) => (
                  <Chip
                    key={d.id}
                    ativo={dificuldade === d.id}
                    onClick={() => setDificuldade(d.id)}
                  >
                    {d.icone} {d.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Nº de questões
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUANTIDADES.map((q) => (
                    <Chip key={q} ativo={quantidade === q} onClick={() => setQuantidade(q)}>
                      {q}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Prova
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip ativo={ano === "aleatorio"} onClick={() => setAno("aleatorio")}>
                    🎲 Aleatória
                  </Chip>
                  <select
                    value={ano === "aleatorio" ? "" : ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 text-gray-100 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="" disabled>
                      Escolher ano
                    </option>
                    {ANOS.map((a) => (
                      <option key={a} value={a}>
                        ENEM {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={modoProva}
                onClick={() => setModoProva((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  modoProva ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    modoProva ? "translate-x-6" : ""
                  }`}
                />
              </button>
              <span className="text-sm text-gray-300">
                <span className="font-semibold text-white">Modo prova</span> — tempo
                limite de {formatarTempo(quantidade * SEGUNDOS_POR_QUESTAO)} (3 min/questão).
                Sem tempo limite = cronômetro livre.
              </span>
            </label>

            {erroCarga && (
              <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                {erroCarga}
              </p>
            )}

            <button
              type="button"
              onClick={iniciarSimulado}
              disabled={carregando}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
            >
              {carregando ? "Preparando questões..." : "🚀 Iniciar simulado"}
            </button>
          </div>
        </div>

        {/* Resumo + Ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-200 mb-4">Seus números</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-black text-white">{resumo.total}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Simulados</p>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-400">{resumo.melhorPct}%</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Recorde</p>
              </div>
              <div>
                <p className="text-2xl font-black text-cyan-400">{resumo.mediaPct}%</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Média</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-200 mb-4">🏆 Ranking pessoal</h3>
            {top.length === 0 ? (
              <p className="text-gray-600 text-sm">Faça um simulado para entrar no ranking.</p>
            ) : (
              <ol className="space-y-2">
                {top.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-300">
                      <span className="w-5 text-center font-black text-gray-500">{i + 1}º</span>
                      {medalhaDe(s.pct)?.icone || "•"} {s.pct}%
                    </span>
                    <span className="text-gray-600 text-xs">
                      {s.totalQuestoes} q · {formatarTempo(s.tempoSegundos)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Conquistas */}
        <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 mb-6">
          <h3 className="text-sm font-bold text-gray-200 mb-4">Conquistas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {listaConquistas.map((c) => (
              <div
                key={c.id}
                title={c.desc}
                className={`p-3 rounded-xl border text-center transition-all ${
                  c.ok
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-gray-900/40 border-gray-800 opacity-50 grayscale"
                }`}
              >
                <p className="text-2xl">{c.icone}</p>
                <p className="text-[11px] font-bold text-gray-200 mt-1">{c.nome}</p>
                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendações + histórico */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-200 mb-4">💡 Recomendações de estudo</h3>
            <ul className="space-y-3">
              {recs.map((r, i) => (
                <li key={i} className="text-sm text-gray-400 leading-relaxed border-l-2 border-blue-500/40 pl-3">
                  {r.texto}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
            <h3 className="text-sm font-bold text-gray-200 mb-4">Histórico</h3>
            {historico.length === 0 ? (
              <p className="text-gray-600 text-sm">Nenhum simulado ainda.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {historico.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-gray-900/50 border border-gray-800"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{medalhaDe(s.pct)?.icone || "📝"}</span>
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-200 font-semibold">
                          {s.pct}%{" "}
                          <span className="text-gray-500 font-normal">
                            ({s.acertos}/{s.totalQuestoes})
                          </span>
                        </span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          {s.modo} · {new Date(s.dataISO).toLocaleDateString("pt-BR")}
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-600 whitespace-nowrap">
                      {formatarTempo(s.tempoSegundos)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- RODANDO ------------------------------ */
  if (fase === "rodando") {
    const pctFeito = total ? Math.round((respondidas / total) * 100) : 0;
    return (
      <div className="max-w-3xl" ref={cardTopoRef}>
        {/* HUD */}
        <div className="sticky top-0 z-20 -mx-2 px-2 pt-2 pb-3 bg-gray-950/90 backdrop-blur-md">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-900/40 border border-gray-800">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <span className="text-sm font-black text-white">
                Questão {indice + 1}
                <span className="text-gray-500 font-bold"> de {total}</span>
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono font-black text-lg px-3 py-1 rounded-lg border ${
                    tempoBaixo
                      ? "text-rose-300 border-rose-500/40 bg-rose-500/10 animate-pulse"
                      : "text-cyan-300 border-cyan-500/30 bg-cyan-500/10"
                  }`}
                >
                  ⏱ {formatarTempo(segundos)}
                </span>
                <span className="text-xs text-gray-500">
                  {respondidas}/{total} respondidas
                </span>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                animate={{ width: `${pctFeito}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                onClick={() => setRevisaoGrade((v) => !v)}
                className="text-xs font-semibold text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-blue-500/50 px-3 py-1.5 rounded-lg transition active:scale-95"
              >
                🧭 Mapa de questões
              </button>
              <button
                type="button"
                onClick={finalizarSimulado}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 px-4 py-1.5 rounded-lg transition active:scale-95 shadow-lg shadow-emerald-600/20"
              >
                ✔ Finalizar simulado
              </button>
            </div>
          </div>

          <AnimatePresence>
            {revisaoGrade && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-4 rounded-2xl bg-gray-900/70 border border-gray-800">
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
                    {questoes.map((q, i) => {
                      const feita = !!respostas[idQuestao(q)];
                      const atual = i === indice;
                      return (
                        <button
                          key={idQuestao(q)}
                          type="button"
                          onClick={() => irPara(i)}
                          className={`aspect-square rounded-lg text-xs font-bold border transition-all active:scale-90 ${
                            feita
                              ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
                              : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                          } ${atual ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900" : ""}`}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Questão (sem revelar gabarito — modo simulado) */}
        <div className="mt-4 overflow-hidden">
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
                resposta={respostas[idQuestao(questaoAtual)]}
                onResponder={responder}
                revelar={false}
                dificuldade={estimarDificuldade(questaoAtual)}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navegação */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={anterior}
            disabled={indice === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-700 bg-gray-800/50 text-gray-200 hover:border-blue-500/50 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          {indice >= total - 1 ? (
            <button
              type="button"
              onClick={finalizarSimulado}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition active:scale-95"
            >
              ✔ Finalizar
            </button>
          ) : (
            <button
              type="button"
              onClick={proxima}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-blue-500 bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition active:scale-95"
            >
              Próxima →
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ RESULTADO ----------------------------- */
  if (fase === "resultado" && resultado) {
    if (revisarQuestoes) {
      return (
        <div className="max-w-3xl">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-100">Revisão do simulado</h1>
            <button
              type="button"
              onClick={() => setRevisarQuestoes(false)}
              className="text-sm font-semibold text-gray-300 bg-gray-800/60 border border-gray-700 hover:border-blue-500/50 px-4 py-2 rounded-xl transition active:scale-95"
            >
              ← Voltar ao resultado
            </button>
          </div>
          <div className="flex flex-col gap-6">
            {questoes.map((q) => (
              <QuestaoCard
                key={idQuestao(q)}
                questao={q}
                resposta={respostas[idQuestao(q)]}
                revelar
                dificuldade={estimarDificuldade(q)}
              />
            ))}
          </div>
        </div>
      );
    }

    const r = resultado;
    const c = r.comparacao;
    return (
      <div className="max-w-3xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-[2rem] bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 shadow-2xl text-center mb-6"
        >
          {r.medalhaObj ? (
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
              className="text-7xl mb-2"
            >
              {r.medalhaObj.icone}
            </motion.div>
          ) : (
            <div className="text-6xl mb-2">📊</div>
          )}

          <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            {r.pct}%
          </p>
          <p className="text-gray-400 mt-1">
            {r.acertos} de {r.totalQuestoes} questões
            {r.medalhaObj ? ` · Medalha de ${r.medalhaObj.nome}` : ""}
          </p>

          {c.recorde && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 inline-block text-sm font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 rounded-full"
            >
              🎉 Novo recorde pessoal!
            </motion.p>
          )}
          {!c.recorde && c.deltaMedia != null && (
            <p className="mt-3 text-sm text-gray-500">
              {c.deltaMedia >= 0 ? "▲" : "▼"} {Math.abs(c.deltaMedia)}% em relação à
              sua média ({c.mediaAntes}%)
            </p>
          )}
          {c.primeiro && (
            <p className="mt-3 text-sm text-blue-300">Seu primeiro simulado — boa! 🚀</p>
          )}
        </motion.div>

        {/* Estatísticas do simulado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { v: r.acertos, l: "Acertos", c: "text-emerald-400" },
            { v: r.erros, l: "Erros", c: "text-rose-400" },
            { v: r.emBranco, l: "Em branco", c: "text-gray-300" },
            { v: formatarTempo(r.tempoSegundos), l: "Tempo", c: "text-cyan-400" },
          ].map((x) => (
            <div key={x.l} className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800 text-center">
              <p className={`text-2xl font-black ${x.c}`}>{x.v}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mt-1">
                {x.l}
              </p>
            </div>
          ))}
        </div>

        {/* Desempenho por matéria neste simulado */}
        {r.porMateriaArr.length > 0 && (
          <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 mb-6">
            <h3 className="text-sm font-bold text-gray-200 mb-4">Desempenho por matéria</h3>
            <div className="space-y-4">
              {r.porMateriaArr.map((m) => (
                <div key={m.name}>
                  <div className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-gray-300 font-medium truncate">{m.name}</span>
                    <span className="text-gray-500 text-xs">
                      {m.acertos}/{m.total} · {m.pct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        m.pct >= 70 ? "bg-emerald-500" : m.pct >= 40 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRevisarQuestoes(true)}
            className="flex-1 min-w-[140px] py-3 rounded-xl text-sm font-bold border border-gray-700 bg-gray-800/50 text-gray-200 hover:border-blue-500/50 transition active:scale-95"
          >
            🔍 Revisar questões
          </button>
          <button
            type="button"
            onClick={refazer}
            className="flex-1 min-w-[140px] py-3 rounded-xl text-sm font-bold border border-blue-500 bg-blue-600 text-white hover:bg-blue-500 transition active:scale-95 shadow-lg shadow-blue-600/30"
          >
            🔁 Refazer igual
          </button>
          <button
            type="button"
            onClick={() => setFase("config")}
            className="flex-1 min-w-[140px] py-3 rounded-xl text-sm font-bold border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500 transition active:scale-95 shadow-lg shadow-emerald-600/30"
          >
            ✨ Novo simulado
          </button>
        </div>
      </div>
    );
  }

  return null;
}
