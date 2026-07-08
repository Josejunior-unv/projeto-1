import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  FileText,
  HelpCircle,
  AlertTriangle,
  Terminal,
  Trash2,
  Check,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { MATERIAS } from "../constants/materias";
import {
  estatisticasUerj,
  listarProvasUerj,
  listarLogsUerj,
  listarNaoClassificadas,
  corrigirClassificacao,
  excluirProvaUerj,
} from "./questoesUerjService";
import { Botao, Cartao, Selo, Alerta, Esqueleto, EstadoVazio, CampoSelect } from "./ui";
import { cx } from "./ui/cx";

// Aba "Provas UERJ" do Painel do Admin: acompanha a importação feita pelo
// pipeline (scripts/importador_uerj), mostra logs, permite corrigir
// classificações e remover provas duplicadas/erradas.

const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const COR_NIVEL = {
  erro: "text-rose-400",
  aviso: "text-amber-400",
  info: "text-ink-400",
};

async function buscarTudo() {
  const [s, p, l, n] = await Promise.all([
    estatisticasUerj(),
    listarProvasUerj(),
    listarLogsUerj(),
    listarNaoClassificadas(),
  ]);
  return { s, p, l, n };
}

function Indicadores({ stats }) {
  const itens = [
    { icone: FileText, valor: stats.provas, rotulo: "Provas importadas" },
    { icone: HelpCircle, valor: stats.questoes, rotulo: "Questões no banco" },
    {
      icone: AlertTriangle,
      valor: stats.naoClassificadas,
      rotulo: "Não classificadas",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {itens.map((i) => (
        <Cartao key={i.rotulo} className="p-4">
          <i.icone size={16} className="text-gold-400 mb-2" />
          <p className="font-display text-2xl font-black text-white tabular-nums leading-none">
            {i.valor}
          </p>
          <p className="text-xs text-ink-400 font-semibold mt-1.5">{i.rotulo}</p>
        </Cartao>
      ))}
    </div>
  );
}

export default function GerenciarProvasUerj() {
  const [stats, setStats] = useState(null);
  const [provas, setProvas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroTabela, setErroTabela] = useState(false);
  const [status, setStatus] = useState("");
  const [edicoes, setEdicoes] = useState({}); // id -> {disciplina, assunto}

  // Aplica o resultado do buscarTudo (sempre chamado de forma assíncrona,
  // dentro de .then — a regra react-hooks estrita proíbe setState síncrono
  // em efeitos).
  const aplicar = useCallback(({ s, p, l, n }) => {
    if (s.erro || p.error) {
      setErroTabela(true);
      setCarregando(false);
      return;
    }
    setStats(s);
    setProvas(p.data);
    setLogs(l.data);
    setPendentes(n.data);
    setCarregando(false);
  }, []);

  const carregar = useCallback(() => {
    buscarTudo().then(aplicar);
  }, [aplicar]);

  useEffect(() => {
    let ativo = true;
    buscarTudo().then((dados) => {
      if (ativo) aplicar(dados);
    });
    return () => {
      ativo = false;
    };
  }, [aplicar]);

  const mostrarStatus = (texto) => {
    setStatus(texto);
    setTimeout(() => setStatus(""), 4000);
  };

  async function salvarClassificacao(q) {
    const edicao = edicoes[q.id] || {};
    const disciplina = edicao.disciplina || q.disciplina;
    if (!disciplina || disciplina === "Não Classificada") {
      return mostrarStatus("Escolha uma disciplina antes de salvar.");
    }
    const { error } = await corrigirClassificacao(q.id, disciplina, edicao.assunto);
    if (error) return mostrarStatus("Falha ao salvar a classificação.");
    setPendentes((prev) => prev.filter((x) => x.id !== q.id));
    setStats((prev) =>
      prev ? { ...prev, naoClassificadas: prev.naoClassificadas - 1 } : prev,
    );
    mostrarStatus("Classificação salva.");
  }

  async function removerProva(p) {
    const anterior = provas;
    setProvas((prev) => prev.filter((x) => x.id !== p.id));
    const { error } = await excluirProvaUerj(p.id);
    if (error) {
      setProvas(anterior);
      mostrarStatus("Não foi possível excluir a prova.");
    } else {
      mostrarStatus("Prova removida (as questões dela saíram junto).");
    }
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} className="h-24" />
          ))}
        </div>
        <Esqueleto className="h-40" />
      </div>
    );
  }

  if (erroTabela) {
    return (
      <Alerta variante="aviso">
        As tabelas de provas da UERJ ainda não existem neste banco. Rode a
        parte 7 do <code className="font-bold">supabase_migration.sql</code> no
        SQL Editor do Supabase e recarregue esta página.
      </Alerta>
    );
  }

  return (
    <div>
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 text-sm font-medium px-4 py-2.5 rounded-xl border text-gold-300 border-gold-400/30 bg-gold-400/10"
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <GraduationCap size={19} className="text-gold-400" /> Provas da UERJ
        </h2>
        <Botao
          variante="secundario"
          tamanho="sm"
          onClick={() => {
            setCarregando(true);
            carregar();
          }}
        >
          <RefreshCw size={13} /> Atualizar
        </Botao>
      </div>

      <Indicadores stats={stats} />

      {/* COMO SINCRONIZAR */}
      <Cartao className="p-5 mb-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink-100 mb-2">
          <Terminal size={15} className="text-gold-400" /> Sincronizar novas provas
        </h3>
        <p className="text-sm text-ink-400 leading-6">
          A importação roda fora do navegador (o site da UERJ não permite
          acesso direto pelo app). No computador, execute:
        </p>
        <pre className="mt-3 p-3 rounded-xl bg-ink-950/60 border border-ink-700 text-xs text-gold-300 overflow-x-auto">
          {`cd scripts/importador_uerj
pip install -r requirements.txt
python main.py`}
        </pre>
        <p className="text-xs text-ink-500 mt-2">
          O pipeline descobre edições novas sozinho, não duplica nada
          (SHA-256) e publica direto neste banco. Detalhes no README da pasta.
        </p>
      </Cartao>

      {/* NÃO CLASSIFICADAS */}
      <h3 className="text-sm font-bold text-ink-100 mb-3">
        Questões não classificadas{" "}
        <span className="text-ink-500 font-semibold">({pendentes.length} pendentes)</span>
      </h3>
      {pendentes.length === 0 ? (
        <p className="text-sm text-ink-500 mb-6">
          Nenhuma pendência — todas as questões têm disciplina definida.
        </p>
      ) : (
        <ul className="space-y-3 mb-8">
          {pendentes.slice(0, 12).map((q) => (
            <li
              key={q.id}
              className="p-4 rounded-2xl bg-ink-900/50 border border-ink-800"
            >
              <p className="text-xs text-ink-500 mb-1 tabular-nums">
                UERJ {q.prova?.ano ?? "?"} · {q.prova?.fase ?? ""} · Questão{" "}
                {q.numero}
              </p>
              <p className="text-sm text-ink-200 line-clamp-2 mb-3">
                {q.enunciado}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <CampoSelect
                  value={edicoes[q.id]?.disciplina || ""}
                  onChange={(e) =>
                    setEdicoes((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], disciplina: e.target.value },
                    }))
                  }
                  className="!w-auto py-1.5 text-xs"
                >
                  <option value="">Disciplina...</option>
                  {MATERIAS.map((m) => (
                    <option key={m.nome} value={m.nome}>
                      {m.nome}
                    </option>
                  ))}
                  <option value="Redação">Redação</option>
                </CampoSelect>
                <input
                  value={edicoes[q.id]?.assunto || ""}
                  onChange={(e) =>
                    setEdicoes((prev) => ({
                      ...prev,
                      [q.id]: { ...prev[q.id], assunto: e.target.value },
                    }))
                  }
                  placeholder="Assunto (opcional)"
                  className="flex-1 min-w-[140px] bg-ink-950/60 border border-ink-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-ink-500 focus:outline-none focus:border-gold-400/70 transition"
                />
                <Botao tamanho="sm" onClick={() => salvarClassificacao(q)}>
                  <Check size={13} /> Salvar
                </Botao>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* PROVAS IMPORTADAS */}
      <h3 className="text-sm font-bold text-ink-100 mb-3">
        Provas importadas{" "}
        <span className="text-ink-500 font-semibold">({provas.length})</span>
      </h3>
      {provas.length === 0 ? (
        <EstadoVazio
          icone={FileText}
          titulo="Nenhuma prova importada ainda"
          descricao="Rode o pipeline acima para trazer as provas do site da UERJ."
          className="mb-8"
        />
      ) : (
        <ul className="space-y-2 mb-8 max-h-96 overflow-y-auto pr-1">
          {provas.map((p) => (
            <li
              key={p.id}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-900/50 border border-ink-800 hover:border-ink-700 transition"
            >
              <span className="font-display font-black text-ink-400 tabular-nums w-12">
                {p.ano || "—"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {p.titulo}
                </p>
                <p className="text-[11px] text-ink-500">
                  {p.tipo}
                  {p.fase ? ` · ${p.fase}` : ""}
                  {p.disciplina ? ` · ${p.disciplina}` : ""} ·{" "}
                  {formatarData(p.criado_em)}
                </p>
              </div>
              <Selo variante={p.status === "processada" ? "sucesso" : "neutro"}>
                {p.status}
              </Selo>
              <button
                onClick={() => removerProva(p)}
                title="Excluir prova (e suas questões)"
                className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* LOGS */}
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink-100 mb-3">
        <ScrollText size={15} className="text-gold-400" /> Últimos eventos da importação
      </h3>
      {logs.length === 0 ? (
        <p className="text-sm text-ink-500">
          Nenhum evento registrado ainda — os logs aparecem aqui a cada
          execução do pipeline.
        </p>
      ) : (
        <ul className="space-y-1.5 font-mono text-xs">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex items-start gap-3 px-3 py-2 rounded-lg bg-ink-950/50 border border-white/[0.04]"
            >
              <span className="text-ink-600 whitespace-nowrap">
                {formatarData(l.criado_em)}
              </span>
              <span className={cx("font-bold uppercase", COR_NIVEL[l.nivel] || "text-ink-400")}>
                {l.nivel}
              </span>
              <span className="text-ink-300 break-all">
                {l.evento}
                {l.detalhes && Object.keys(l.detalhes).length > 0
                  ? ` — ${JSON.stringify(l.detalhes)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
