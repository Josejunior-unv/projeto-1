import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  LayoutGrid,
  Timer,
  Trophy,
  RotateCcw,
} from "lucide-react";
import QuestaoCard from "../questoes/QuestaoCard.jsx";
import { adaptarParaCard } from "../questoesUerjService";
import { registrarRespostaEnem } from "../estatisticas.js";
import {
  registrarResposta,
  salvarResultadoUerj,
  carregarHistoricoUerj,
} from "./uerjEstudoService";
import { Botao, Indicador, BarraProgresso, Cartao } from "../ui";
import { cx } from "../ui/cx";

// Runner compartilhado por Provas Completas e Simulados da UERJ:
// responde tudo dentro do app, com cronômetro, grade de navegação e
// tela de resultado (nota, desempenho por disciplina, marca pessoal).

const formatarTempo = (seg) => {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function ExecutorQuestoes({
  questoes,
  titulo,
  tipo = "prova", // 'prova' | 'simulado' — só para o histórico
  userId,
  onSair,
}) {
  const [fase, setFase] = useState("rodando"); // rodando | resultado | revisao
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [segundos, setSegundos] = useState(0);
  const [grade, setGrade] = useState(false);
  const [direcao, setDirecao] = useState(1);
  const [resultado, setResultado] = useState(null);
  // Marca de tempo da questão atual (definida em efeito: Date.now() é
  // impuro e não pode rodar durante o render).
  const inicioQuestaoRef = useRef(0);
  const temposRef = useRef({});

  useEffect(() => {
    inicioQuestaoRef.current = Date.now();
  }, []);

  const total = questoes.length;
  const questaoAtual = questoes[indice] || null;
  const respondidas = Object.keys(respostas).length;

  // Cronômetro (conta para cima).
  useEffect(() => {
    if (fase !== "rodando") return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [fase]);

  const irPara = useCallback(
    (novo) => {
      const alvo = Math.max(0, Math.min(novo, total - 1));
      setDirecao(alvo > indice ? 1 : -1);
      setIndice(alvo);
      inicioQuestaoRef.current = Date.now();
    },
    [indice, total],
  );

  const responder = useCallback(
    (letra) => {
      if (!questaoAtual) return;
      temposRef.current[questaoAtual.id] =
        (temposRef.current[questaoAtual.id] || 0) +
        (Date.now() - inicioQuestaoRef.current) / 1000;
      inicioQuestaoRef.current = Date.now();
      setRespostas((prev) => ({ ...prev, [questaoAtual.id]: letra }));
    },
    [questaoAtual],
  );

  const finalizar = useCallback(() => {
    let acertos = 0;
    const porDisciplina = {};
    const porAssunto = {};
    questoes.forEach((q) => {
      const d = q.disciplina || "Não Classificada";
      const a = q.assunto || "Não Classificado";
      porDisciplina[d] ||= { acertos: 0, total: 0 };
      porAssunto[a] ||= { acertos: 0, total: 0 };
      porDisciplina[d].total++;
      porAssunto[a].total++;
      const r = respostas[q.id];
      const acertou = r && q.resposta && r === q.resposta;
      if (acertou) {
        acertos++;
        porDisciplina[d].acertos++;
        porAssunto[a].acertos++;
      }
      // Progresso local + estatísticas globais (só questões com gabarito).
      if (r) {
        registrarResposta(userId, q, r, temposRef.current[q.id]);
        if (q.resposta && userId) {
          registrarRespostaEnem(userId, r === q.resposta, d).catch(() => {});
        }
      }
    });

    const pct = total ? Math.round((acertos / total) * 100) : 0;
    const anteriores = carregarHistoricoUerj(userId).filter(
      (h) => h.tipo === tipo,
    );
    const recorde = anteriores.reduce((m, h) => Math.max(m, h.pct || 0), 0);

    const res = {
      tipo,
      titulo,
      total,
      respondidas: Object.keys(respostas).length,
      acertos,
      erros: Object.keys(respostas).length - acertos,
      emBranco: total - Object.keys(respostas).length,
      pct,
      tempoSegundos: segundos,
      porDisciplina,
      porAssunto,
      novoRecorde: pct > recorde && anteriores.length > 0,
      recordeAnterior: recorde,
    };
    salvarResultadoUerj(userId, res);
    setResultado(res);
    setFase("resultado");
  }, [questoes, respostas, total, segundos, titulo, tipo, userId]);

  /* ---------------- RESULTADO ---------------- */
  if (fase === "resultado" && resultado) {
    const disciplinas = Object.entries(resultado.porDisciplina)
      .map(([nome, v]) => ({
        nome,
        ...v,
        pct: v.total ? Math.round((v.acertos / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <Cartao className="p-8 text-center">
          {resultado.novoRecorde && (
            <p className="inline-flex items-center gap-2 text-sm font-bold text-gold-300 bg-gold-400/10 border border-gold-400/25 px-3 py-1.5 rounded-xl mb-4">
              <Trophy size={15} /> Novo recorde pessoal!
            </p>
          )}
          <p className="font-display text-6xl font-black text-gold-400 tabular-nums">
            {resultado.pct}%
          </p>
          <p className="text-ink-400 mt-2">
            {resultado.acertos} de {resultado.total} questões ·{" "}
            {formatarTempo(resultado.tempoSegundos)}
          </p>

          <div className="flex items-center justify-center gap-8 mt-6">
            <Indicador valor={resultado.acertos} rotulo="Acertos" cor="text-emerald-400" />
            <Indicador valor={resultado.erros} rotulo="Erros" cor="text-rose-400" />
            <Indicador valor={resultado.emBranco} rotulo="Em branco" cor="text-ink-300" />
          </div>

          {disciplinas.length > 1 && (
            <div className="mt-8 text-left">
              <p className="text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-3">
                Desempenho por disciplina
              </p>
              <div className="space-y-3">
                {disciplinas.map((d) => (
                  <div key={d.nome}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-ink-200">{d.nome}</span>
                      <span className="text-ink-400 tabular-nums">
                        {d.acertos}/{d.total} · {d.pct}%
                      </span>
                    </div>
                    <BarraProgresso
                      valor={d.pct}
                      cor={d.pct >= 60 ? "bg-emerald-400" : "bg-rose-400"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <Botao variante="secundario" onClick={() => setFase("revisao")}>
              <LayoutGrid size={15} /> Revisar questões
            </Botao>
            <Botao onClick={onSair}>
              <RotateCcw size={15} /> Concluir
            </Botao>
          </div>
        </Cartao>
      </motion.div>
    );
  }

  /* ---------------- RODANDO / REVISÃO ---------------- */
  const revisao = fase === "revisao";
  const respostaAtual = questaoAtual ? respostas[questaoAtual.id] : undefined;

  return (
    <div className="max-w-3xl">
      <button
        onClick={onSair}
        className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
      >
        <ArrowLeft size={16} /> Sair {revisao ? "da revisão" : ""}
      </button>

      {/* HUD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-card)] mb-4 sticky top-0 z-20">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-500 truncate">{titulo}</p>
            <p className="text-sm font-black text-white font-display tabular-nums">
              Questão {indice + 1}
              <span className="text-ink-500 font-bold"> de {total}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            {!revisao && (
              <span className="inline-flex items-center gap-1.5 font-mono font-black text-lg px-3 py-1 rounded-lg text-gold-300 border border-gold-400/30 bg-gold-400/10 tabular-nums">
                <Timer size={15} /> {formatarTempo(segundos)}
              </span>
            )}
            <span className="text-xs text-ink-500 tabular-nums">
              {respondidas}/{total} respondidas
            </span>
          </div>
        </div>
        <BarraProgresso valor={total ? (respondidas / total) * 100 : 0} altura="h-2" />
        <div className="flex items-center justify-between gap-2 mt-3">
          <Botao variante="secundario" tamanho="sm" onClick={() => setGrade((v) => !v)}>
            <LayoutGrid size={13} /> Mapa
          </Botao>
          {!revisao && (
            <Botao
              tamanho="sm"
              onClick={finalizar}
              className="!bg-emerald-500 hover:!bg-emerald-400 !text-white"
            >
              <Flag size={13} /> Finalizar
            </Botao>
          )}
        </div>
      </div>

      {/* GRADE */}
      <AnimatePresence>
        {grade && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-4 rounded-2xl bg-ink-900 border border-white/[0.06] grid grid-cols-8 sm:grid-cols-12 gap-2">
              {questoes.map((q, i) => {
                const r = respostas[q.id];
                let cor = r
                  ? "bg-gold-400/15 text-gold-200 border-gold-400/40"
                  : "bg-ink-800 text-ink-400 border-white/[0.06] hover:border-ink-500";
                if (revisao && r) {
                  cor =
                    q.resposta && r === q.resposta
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40";
                }
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      irPara(i);
                      setGrade(false);
                    }}
                    className={cx(
                      "aspect-square rounded-lg text-xs font-bold border transition-all active:scale-90 tabular-nums",
                      cor,
                      i === indice &&
                        "ring-2 ring-gold-400 ring-offset-2 ring-offset-ink-900",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUESTÃO */}
      {questaoAtual && (
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direcao}>
            <motion.div
              key={questaoAtual.id}
              custom={direcao}
              initial={{ opacity: 0, x: direcao * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direcao * -40 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <QuestaoCard
                questao={adaptarParaCard(questaoAtual)}
                resposta={respostaAtual}
                onResponder={revisao ? undefined : responder}
                revelar={revisao}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <Botao variante="secundario" onClick={() => irPara(indice - 1)} disabled={indice === 0}>
          <ChevronLeft size={16} /> Anterior
        </Botao>
        {indice >= total - 1 && !revisao ? (
          <Botao
            onClick={finalizar}
            className="!bg-emerald-500 hover:!bg-emerald-400 !text-white"
          >
            <Flag size={15} /> Finalizar {tipo === "prova" ? "prova" : "simulado"}
          </Botao>
        ) : (
          <Botao onClick={() => irPara(indice + 1)} disabled={indice >= total - 1}>
            Próxima <ChevronRight size={16} />
          </Botao>
        )}
      </div>
    </div>
  );
}
