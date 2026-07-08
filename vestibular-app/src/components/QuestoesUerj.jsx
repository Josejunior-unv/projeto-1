import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, FolderOpen, Info } from "lucide-react";
import { registrarRespostaEnem } from "./estatisticas.js";
import { listarQuestoesUerj, adaptarParaCard } from "./questoesUerjService";
import { usePersistedState } from "../hooks/usePersistedState";
import QuestaoCard from "./questoes/QuestaoCard.jsx";
import { Botao, Indicador, BarraProgresso, CampoSelect, EstadoVazio, Esqueleto } from "./ui";

// Navegador de questões da UERJ de UMA disciplina (aberto pelo hub de
// Questões). Reutiliza o QuestaoCard e grava acertos/erros na mesma tabela
// das Estatísticas (questoes_respondidas), então o dashboard reflete tudo.

const chaveStorage = (userId) => `uerj_respostas_${userId || "anon"}`;

function carregarRespostasLocais(userId) {
  try {
    return JSON.parse(localStorage.getItem(chaveStorage(userId))) || {};
  } catch {
    return {};
  }
}

export default function QuestoesUerj({ disciplina, userId }) {
  const [questoes, setQuestoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [respostas, setRespostas] = useState(() => carregarRespostasLocais(userId));
  const [busca, setBusca] = useState("");
  const [anoFiltro, setAnoFiltro] = useState("todos");
  const [indice, setIndice] = usePersistedState(`uerj_indice_${disciplina}`, 0);
  const [direcao, setDirecao] = useState(1);

  useEffect(() => {
    let ativo = true;
    listarQuestoesUerj(disciplina).then(({ data }) => {
      if (!ativo) return;
      setQuestoes(data);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [disciplina]);

  useEffect(() => {
    try {
      localStorage.setItem(chaveStorage(userId), JSON.stringify(respostas));
    } catch {
      // Cota do localStorage cheia: o progresso vale só na sessão.
    }
  }, [respostas, userId]);

  const anosDisponiveis = useMemo(
    () =>
      [...new Set(questoes.map((q) => q.prova?.ano).filter(Boolean))].sort(
        (a, b) => b - a,
      ),
    [questoes],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return questoes.filter((q) => {
      if (anoFiltro !== "todos" && q.prova?.ano !== Number(anoFiltro)) return false;
      if (termo && !`${q.enunciado} ${q.assunto || ""}`.toLowerCase().includes(termo))
        return false;
      return true;
    });
  }, [questoes, busca, anoFiltro]);

  const total = filtradas.length;
  const indiceAtual = total === 0 ? 0 : Math.min(indice, total - 1);
  const questaoAtual = filtradas[indiceAtual] || null;
  const respostaAtual = questaoAtual ? respostas[questaoAtual.id] : undefined;
  const temGabarito = !!questaoAtual?.resposta;

  const progresso = useMemo(() => {
    let respondidas = 0;
    let acertos = 0;
    filtradas.forEach((q) => {
      const r = respostas[q.id];
      if (!r) return;
      respondidas++;
      if (q.resposta && r === q.resposta) acertos++;
    });
    return {
      respondidas,
      acertos,
      erros: respondidas - acertos,
      pctFeito: total ? Math.round((respondidas / total) * 100) : 0,
    };
  }, [filtradas, respostas, total]);

  const irPara = useCallback(
    (novo) => {
      setDirecao(novo > indiceAtual ? 1 : -1);
      setIndice(Math.max(0, Math.min(novo, total - 1)));
    },
    [indiceAtual, total, setIndice],
  );

  const responder = useCallback(
    (letra) => {
      if (!questaoAtual || respostas[questaoAtual.id]) return;
      setRespostas((prev) => ({ ...prev, [questaoAtual.id]: letra }));
      // Só entra nas estatísticas quando há gabarito oficial para corrigir.
      if (userId && questaoAtual.resposta) {
        registrarRespostaEnem(
          userId,
          letra === questaoAtual.resposta,
          disciplina,
        ).catch(() => {});
      }
    },
    [questaoAtual, respostas, userId, disciplina],
  );

  if (carregando) {
    return <Esqueleto className="h-96 mt-4" />;
  }

  if (questoes.length === 0) {
    return (
      <EstadoVazio
        icone={FolderOpen}
        titulo="Nenhuma questão nesta pasta ainda"
        descricao={`As questões de ${disciplina} aparecem aqui assim que forem importadas.`}
        className="mt-4"
      />
    );
  }

  return (
    <div className="mt-2">
      {/* HUD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-card)] mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <span className="text-sm font-black text-white font-display tabular-nums">
            Questão {total === 0 ? 0 : indiceAtual + 1}
            <span className="text-ink-500 font-bold"> de {total}</span>
          </span>
          <div className="flex items-center gap-5">
            <Indicador valor={progresso.acertos} rotulo="Acertos" cor="text-emerald-400" />
            <Indicador valor={progresso.erros} rotulo="Erros" cor="text-rose-400" />
          </div>
        </div>
        <BarraProgresso valor={progresso.pctFeito} altura="h-2" />

        <div className="flex items-center gap-2 flex-wrap mt-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setIndice(0);
              }}
              placeholder="Pesquisar no enunciado ou assunto..."
              className="w-full bg-ink-950/60 border border-ink-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
            />
          </div>
          <CampoSelect
            value={anoFiltro}
            onChange={(e) => {
              setAnoFiltro(e.target.value);
              setIndice(0);
            }}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por ano"
          >
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                UERJ {a}
              </option>
            ))}
          </CampoSelect>
        </div>
      </div>

      {/* QUESTÃO */}
      {total === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-ink-700 text-center text-ink-400">
          Nenhuma questão encontrada para estes filtros.
        </div>
      ) : (
        <>
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
                  onResponder={respostaAtual ? undefined : responder}
                  revelar={!!respostaAtual && temGabarito}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sem gabarito oficial: informa em vez de corrigir */}
          {respostaAtual && !temGabarito && (
            <div className="flex items-center gap-2.5 mt-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-ink-300">
              <Info size={16} className="shrink-0 text-gold-400" />
              Resposta registrada: alternativa {respostaAtual}. O gabarito
              oficial desta questão ainda não foi importado.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <Botao
              variante="secundario"
              onClick={() => irPara(indiceAtual - 1)}
              disabled={indiceAtual === 0}
            >
              <ChevronLeft size={16} /> Anterior
            </Botao>
            <span className="text-xs text-ink-500 tabular-nums">
              {questaoAtual.prova?.titulo?.slice(0, 40) ||
                `UERJ ${questaoAtual.prova?.ano ?? ""}`}
            </span>
            <Botao
              onClick={() => irPara(indiceAtual + 1)}
              disabled={indiceAtual >= total - 1}
            >
              Próxima <ChevronRight size={16} />
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}
