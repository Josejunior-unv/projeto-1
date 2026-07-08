import { useState, useEffect } from "react";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import { montarSimulado, opcoesDeFiltro } from "./uerjEstudoService";
import ExecutorQuestoes from "./ExecutorQuestoes";
import { AREAS_CONHECIMENTO, areaPorId } from "../../constants/areasConhecimento";
import { usePersistedState } from "../../hooks/usePersistedState";
import { Botao, CampoSelect, Cartao, Alerta } from "../ui";
import { cx } from "../ui/cx";

// Simulado personalizado com questões da UERJ: o aluno escolhe
// quantidade, ano, disciplina e dificuldade e o sistema monta a
// prova automaticamente (só questões com gabarito oficial).

const QUANTIDADES = [5, 10, 15, 20, 30];

export default function SimuladoUerj({ userId, onVoltar }) {
  const [opcoes, setOpcoes] = useState({ disciplinas: [], anos: [] });
  const [quantidade, setQuantidade] = usePersistedState("uerj_sim_qtd", 10);
  const [area, setArea] = usePersistedState("uerj_sim_area", "");
  const [disciplina, setDisciplina] = usePersistedState("uerj_sim_disc", "");
  const [ano, setAno] = usePersistedState("uerj_sim_ano", "");
  const [dificuldade, setDificuldade] = usePersistedState("uerj_sim_dif", "");
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState("");
  const [executando, setExecutando] = useState(null);

  useEffect(() => {
    opcoesDeFiltro().then(setOpcoes);
  }, []);

  async function iniciar() {
    setErro("");
    setMontando(true);
    const { data } = await montarSimulado({
      quantidade,
      area: area || undefined,
      disciplina: disciplina || undefined,
      ano: ano || undefined,
      dificuldade: dificuldade || undefined,
      userId,
    });
    setMontando(false);
    if (data.length === 0) {
      setErro(
        "Não encontramos questões com gabarito para essa combinação. Tente outros filtros.",
      );
      return;
    }
    setExecutando(data);
  }

  if (executando) {
    return (
      <ExecutorQuestoes
        questoes={executando}
        titulo={`Simulado UERJ · ${executando.length} questões`}
        tipo="simulado"
        userId={userId}
        onSair={() => setExecutando(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      {onVoltar && (
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      <Cartao className="p-6">
        <h3 className="text-lg font-bold text-white mb-1">
          Simulado personalizado
        </h3>
        <p className="text-sm text-ink-400 mb-6">
          Escolha os critérios e o sistema monta o simulado com questões
          oficiais da UERJ (todas com gabarito).
        </p>

        <p className="text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-2">
          Nº de questões
        </p>
        <div className="flex gap-2 flex-wrap mb-5">
          {QUANTIDADES.map((n) => (
            <button
              key={n}
              onClick={() => setQuantidade(n)}
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 tabular-nums",
                quantidade === n
                  ? "bg-gold-400 text-ink-950 border-gold-400 shadow-[var(--shadow-gold)]"
                  : "bg-white/[0.03] text-ink-300 border-white/[0.08] hover:border-gold-400/40",
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <CampoSelect
            rotulo="Área"
            value={area}
            onChange={(e) => {
              const nova = e.target.value;
              setArea(nova);
              const info = areaPorId(nova);
              if (info && disciplina && !info.disciplinas.includes(disciplina)) {
                setDisciplina("");
              }
            }}
            className="py-2 text-sm"
          >
            <option value="">Todas</option>
            {AREAS_CONHECIMENTO.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            rotulo="Disciplina"
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            className="py-2 text-sm"
          >
            <option value="">Todas</option>
            {(areaPorId(area)
              ? opcoes.disciplinas.filter((d) =>
                  areaPorId(area).disciplinas.includes(d),
                )
              : opcoes.disciplinas
            ).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            rotulo="Ano"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="py-2 text-sm"
          >
            <option value="">Todos</option>
            {opcoes.anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </CampoSelect>
          <CampoSelect
            rotulo="Dificuldade"
            value={dificuldade}
            onChange={(e) => setDificuldade(e.target.value)}
            className="py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="facil">Fácil</option>
            <option value="media">Média</option>
            <option value="dificil">Difícil</option>
          </CampoSelect>
        </div>

        {erro && (
          <Alerta variante="aviso" className="mb-4">
            {erro}
          </Alerta>
        )}

        <Botao tamanho="lg" className="w-full" onClick={iniciar} disabled={montando}>
          {montando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          {montando ? "Montando simulado..." : "Iniciar simulado"}
        </Botao>
      </Cartao>
    </div>
  );
}
