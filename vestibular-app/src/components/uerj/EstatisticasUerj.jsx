import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Target,
  CheckCircle2,
  Flame,
  Timer,
  History,
  BarChart3,
} from "lucide-react";
import {
  carregarEstudo,
  carregarHistoricoUerj,
  resumoEstudo,
} from "./uerjEstudoService";
import { Cartao, BarraProgresso, EstadoVazio, Selo } from "../ui";
import { cx } from "../ui/cx";

// Dashboard de estudo da UERJ: tudo calculado do progresso local do
// aluno (respostas + histórico de provas/simulados).

const formatarTempo = (seg) => {
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

const formatarData = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function agruparPor(respostas, campo) {
  const mapa = {};
  Object.values(respostas).forEach((r) => {
    const k = r[campo] || "Não Classificada";
    mapa[k] ||= { total: 0, acertos: 0, corrigidas: 0 };
    mapa[k].total++;
    if (r.acertou !== null) {
      mapa[k].corrigidas++;
      if (r.acertou) mapa[k].acertos++;
    }
  });
  return Object.entries(mapa)
    .map(([nome, v]) => ({
      nome,
      ...v,
      pct: v.corrigidas ? Math.round((v.acertos / v.corrigidas) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

// Últimas N semanas de atividade (segunda a domingo).
function evolucaoSemanal(respostas, semanas = 8) {
  const porSemana = {};
  Object.values(respostas).forEach((r) => {
    const d = new Date(r.data + "T00:00:00");
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
    const k = d.toISOString().slice(0, 10);
    porSemana[k] ||= { total: 0, acertos: 0, corrigidas: 0, inicio: k };
    porSemana[k].total++;
    if (r.acertou !== null) {
      porSemana[k].corrigidas++;
      if (r.acertou) porSemana[k].acertos++;
    }
  });
  return Object.values(porSemana)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(-semanas);
}

function TileKpi({ icone: Icone, valor, rotulo, detalhe }) {
  return (
    <Cartao className="p-4">
      <Icone size={16} className="text-gold-400 mb-2" />
      <p className="font-display text-2xl font-black text-white tabular-nums leading-none">
        {valor}
      </p>
      <p className="text-xs text-ink-400 font-semibold mt-1.5">{rotulo}</p>
      {detalhe && <p className="text-[11px] text-ink-500 mt-0.5">{detalhe}</p>}
    </Cartao>
  );
}

export default function EstatisticasUerj({ userId, onVoltar }) {
  const { respostas } = useMemo(() => carregarEstudo(userId), [userId]);
  const resumo = useMemo(() => resumoEstudo(userId), [userId]);
  const historico = useMemo(() => carregarHistoricoUerj(userId), [userId]);
  const porDisciplina = useMemo(() => agruparPor(respostas, "disciplina"), [respostas]);
  const porAssunto = useMemo(
    () => agruparPor(respostas, "assunto").filter((a) => a.nome !== "Não Classificado"),
    [respostas],
  );
  const semanas = useMemo(() => evolucaoSemanal(respostas), [respostas]);
  const maxSemana = Math.max(1, ...semanas.map((s) => s.total));

  if (resumo.respondidas === 0) {
    return (
      <div className="max-w-3xl">
        {onVoltar && (
          <button
            onClick={onVoltar}
            className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        )}
        <EstadoVazio
          icone={BarChart3}
          titulo="Suas estatísticas aparecem aqui"
          descricao="Responda questões no banco, resolva provas completas ou faça simulados — cada resposta alimenta este painel."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {onVoltar && (
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <TileKpi
          icone={Target}
          valor={`${resumo.taxa}%`}
          rotulo="Taxa de acerto"
          detalhe={`${resumo.acertos} acertos · ${resumo.erros} erros`}
        />
        <TileKpi
          icone={CheckCircle2}
          valor={resumo.respondidas}
          rotulo="Questões respondidas"
          detalhe={`${resumo.corrigidas} com correção`}
        />
        <TileKpi
          icone={Flame}
          valor={resumo.sequencia}
          rotulo="Dias seguidos"
          detalhe={resumo.sequencia > 0 ? "continue assim!" : "estude hoje"}
        />
        <TileKpi
          icone={Timer}
          valor={formatarTempo(resumo.tempoMedio)}
          rotulo="Tempo médio/questão"
          detalhe={`${formatarTempo(resumo.tempoTotal)} no total`}
        />
      </div>

      {/* EVOLUÇÃO SEMANAL */}
      {semanas.length > 0 && (
        <Cartao className="p-5 mb-6">
          <h3 className="text-sm font-bold text-ink-100 mb-4">
            Evolução semanal
          </h3>
          <div className="flex items-end gap-2 h-32">
            {semanas.map((s) => {
              const pct = s.corrigidas
                ? Math.round((s.acertos / s.corrigidas) * 100)
                : 0;
              return (
                <div
                  key={s.inicio}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  title={`${s.total} questões · ${pct}% de acerto`}
                >
                  <span className="text-[10px] font-bold text-ink-400 tabular-nums">
                    {s.total}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(s.total / maxSemana) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cx(
                      "w-full max-w-10 rounded-t-lg",
                      pct >= 60 ? "bg-emerald-400/80" : "bg-gold-400/80",
                    )}
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-[10px] text-ink-500 tabular-nums">
                    {formatarData(s.inicio + "T00:00:00")}
                  </span>
                </div>
              );
            })}
          </div>
        </Cartao>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* POR DISCIPLINA */}
        <Cartao className="p-5">
          <h3 className="text-sm font-bold text-ink-100 mb-4">
            Desempenho por disciplina
          </h3>
          <div className="space-y-3">
            {porDisciplina.slice(0, 8).map((d) => (
              <div key={d.nome}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-ink-200">{d.nome}</span>
                  <span className="text-ink-400 tabular-nums">
                    {d.total} questões{d.pct !== null ? ` · ${d.pct}%` : ""}
                  </span>
                </div>
                <BarraProgresso
                  valor={d.pct ?? 0}
                  cor={
                    d.pct === null
                      ? "bg-ink-600"
                      : d.pct >= 60
                        ? "bg-emerald-400"
                        : "bg-rose-400"
                  }
                />
              </div>
            ))}
          </div>
        </Cartao>

        {/* MAPA DE CALOR POR ASSUNTO */}
        <Cartao className="p-5">
          <h3 className="text-sm font-bold text-ink-100 mb-1">
            Mapa de calor por assunto
          </h3>
          <p className="text-[11px] text-ink-500 mb-4">
            Verde = dominado · Vermelho = precisa de atenção
          </p>
          {porAssunto.length === 0 ? (
            <p className="text-sm text-ink-500">
              Responda questões classificadas para ver o mapa.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {porAssunto.slice(0, 20).map((a) => (
                <span
                  key={a.nome}
                  title={`${a.total} questões · ${a.pct ?? "—"}% de acerto`}
                  className={cx(
                    "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border",
                    a.pct === null
                      ? "bg-white/[0.04] text-ink-300 border-white/[0.08]"
                      : a.pct >= 70
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : a.pct >= 40
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30",
                  )}
                >
                  {a.nome} · {a.pct ?? "—"}%
                </span>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      {/* HISTÓRICO */}
      <Cartao className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink-100 mb-4">
          <History size={15} className="text-gold-400" /> Histórico de provas e
          simulados
        </h3>
        {historico.length === 0 ? (
          <p className="text-sm text-ink-500">
            Resolva uma prova completa ou um simulado para começar o histórico.
          </p>
        ) : (
          <ul className="space-y-2">
            {historico.slice(0, 10).map((h, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-950/50 border border-white/[0.04]"
              >
                <Selo variante={h.tipo === "prova" ? "ouro" : "neutro"}>
                  {h.tipo === "prova" ? "Prova" : "Simulado"}
                </Selo>
                <span className="flex-1 min-w-0 text-sm text-ink-200 truncate">
                  {h.titulo}
                </span>
                <span className="text-xs text-ink-500 tabular-nums whitespace-nowrap">
                  {h.acertos}/{h.total} · {formatarTempo(h.tempoSegundos)} ·{" "}
                  {formatarData(h.data)}
                </span>
                <span
                  className={cx(
                    "font-display font-black tabular-nums",
                    h.pct >= 60 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {h.pct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
