import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Link2,
  PlayCircle,
  Download,
  Eye,
  Library,
  FilterX,
  Sparkles,
} from "lucide-react";
import { supabase } from "../SUPABASE";
import { listarMateriais } from "./materiaisService";
import { MATERIAS, coresDe } from "../constants/materias";
import { usePersistedState } from "../hooks/usePersistedState";
import {
  Botao,
  Selo,
  CampoSelect,
  EstadoVazio,
  Esqueleto,
  CabecalhoPagina,
} from "./ui";
import { cx } from "./ui/cx";

// ------------------------------------------------------------
// A biblioteca organiza os materiais publicados em
// Ano → Tipo (Objetiva/Discursiva) → Matéria, deduzindo ano e
// tipo do título/descrição de cada material. Assim o professor
// só precisa nomear bem (ex.: "UERJ 2026 — Discursiva — Física")
// e a prova cai automaticamente na prateleira certa.
// ------------------------------------------------------------

const TIPOS_PROVA = [
  { id: "objetiva", label: "Objetiva" },
  { id: "discursiva", label: "Discursiva" },
];

function extrairAno(m) {
  const alvo = `${m.titulo || ""} ${m.descricao || ""}`;
  const match = alvo.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function extrairTipo(m) {
  const alvo = `${m.titulo || ""} ${m.descricao || ""}`.toLowerCase();
  if (/discursiv/.test(alvo)) return "discursiva";
  // Na UERJ, o Exame de Qualificação é a prova objetiva.
  if (/objetiv|qualifica/.test(alvo)) return "objetiva";
  return null;
}

const rotuloTipo = (id) =>
  TIPOS_PROVA.find((t) => t.id === id)?.label ?? "Material";

// Ícone estático por tipo de material (fora do render, exigência do
// react-hooks/static-components).
const ICONES_TIPO = { video: PlayCircle, link: Link2, pdf: FileText };

/* Card individual de prova/material */
function CartaoProva({ item, indice }) {
  const infoMateria = MATERIAS.find((x) => x.nome === item.materia);
  const c = coresDe(infoMateria?.cor);
  const Icone = ICONES_TIPO[item.tipo] || FileText;
  const ehPdf = item.tipo === "pdf" || /\.pdf(\?|$)/i.test(item.url_arquivo || "");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(indice * 0.03, 0.25), duration: 0.3 }}
      className="group flex flex-col p-5 rounded-2xl bg-ink-900 border border-white/[0.06]
                 shadow-[var(--shadow-card)] transition-all duration-300
                 hover:border-white/[0.14] hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-4">
        <span
          className={cx(
            "w-11 h-11 rounded-xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
            c.fundo,
            c.borda,
            c.texto,
          )}
        >
          <Icone size={20} strokeWidth={1.9} />
        </span>
        {item.anoProva && (
          <span className="font-display text-sm font-black text-ink-500 tabular-nums">
            {item.anoProva}
          </span>
        )}
      </div>

      <h4 className="font-bold text-white leading-snug line-clamp-2">
        {item.titulo}
      </h4>
      {item.descricao && (
        <p className="text-xs text-ink-400 mt-1.5 line-clamp-2 leading-5">
          {item.descricao}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        {item.materia && <Selo className={cx(c.texto)}>{item.materia}</Selo>}
        {item.tipoProva && (
          <Selo variante={item.tipoProva === "discursiva" ? "ouro" : "neutro"}>
            {rotuloTipo(item.tipoProva)}
          </Selo>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.05]">
        <Botao
          as="a"
          href={item.url_arquivo}
          target="_blank"
          rel="noopener noreferrer"
          variante="secundario"
          tamanho="sm"
          className="flex-1"
        >
          <Eye size={14} /> Visualizar
        </Botao>
        {ehPdf && (
          <Botao
            as="a"
            href={item.url_arquivo}
            download={item.arquivo_nome || true}
            variante="fantasma"
            tamanho="sm"
            title="Baixar PDF"
          >
            <Download size={14} /> Baixar
          </Botao>
        )}
      </div>
    </motion.div>
  );
}

export default function BibliotecaProvas() {
  const [materiais, setMateriais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = usePersistedState("bib_busca", "");
  const [anoFiltro, setAnoFiltro] = usePersistedState("bib_ano", "todos");
  const [materiaFiltro, setMateriaFiltro] = usePersistedState(
    "bib_materia",
    "todas",
  );
  const [tipoFiltro, setTipoFiltro] = usePersistedState("bib_tipo", "todos");

  useEffect(() => {
    let ativo = true;
    listarMateriais().then(({ data }) => {
      if (!ativo) return;
      setMateriais(data);
      setCarregando(false);
    });

    const canal = supabase
      .channel("biblioteca_materiais")
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
  }, []);

  // Enriquecemos cada material com ano e tipo de prova deduzidos.
  const itens = useMemo(
    () =>
      materiais.map((m) => ({
        ...m,
        anoProva: extrairAno(m),
        tipoProva: extrairTipo(m),
      })),
    [materiais],
  );

  const anosDisponiveis = useMemo(
    () =>
      [...new Set(itens.map((i) => i.anoProva).filter(Boolean))].sort(
        (a, b) => b - a,
      ),
    [itens],
  );

  const materiasDisponiveis = useMemo(
    () => [...new Set(itens.map((i) => i.materia).filter(Boolean))],
    [itens],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (anoFiltro !== "todos" && i.anoProva !== Number(anoFiltro)) return false;
      if (materiaFiltro !== "todas" && i.materia !== materiaFiltro) return false;
      if (tipoFiltro !== "todos" && i.tipoProva !== tipoFiltro) return false;
      if (termo) {
        const alvo =
          `${i.titulo || ""} ${i.descricao || ""} ${i.materia || ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [itens, busca, anoFiltro, materiaFiltro, tipoFiltro]);

  // Prateleiras: anos em ordem decrescente; sem ano identificado → "Outros".
  const prateleiras = useMemo(() => {
    const mapa = new Map();
    filtrados.forEach((i) => {
      const chave = i.anoProva ?? "outros";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(i);
    });
    return [...mapa.entries()].sort((a, b) => {
      if (a[0] === "outros") return 1;
      if (b[0] === "outros") return -1;
      return b[0] - a[0];
    });
  }, [filtrados]);

  const temFiltroAtivo =
    busca.trim() !== "" ||
    anoFiltro !== "todos" ||
    materiaFiltro !== "todas" ||
    tipoFiltro !== "todos";

  const limparFiltros = () => {
    setBusca("");
    setAnoFiltro("todos");
    setMateriaFiltro("todas");
    setTipoFiltro("todos");
  };

  return (
    <div className="max-w-5xl">
      <CabecalhoPagina
        titulo="Biblioteca UERJ"
        descricao="Todas as provas e materiais, organizados por ano, tipo e matéria."
      />

      {/* BARRA DE FILTROS */}
      <div className="p-4 rounded-2xl bg-ink-900 border border-white/[0.06] mb-8 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar prova, matéria ou assunto..."
            className="w-full bg-ink-950/60 border border-ink-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white
                       placeholder:text-ink-500 transition-colors focus:outline-none focus:border-gold-400/70
                       focus:ring-1 focus:ring-gold-400/40"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tipo — chips */}
          <div className="flex p-1 gap-0.5 bg-ink-950/60 border border-ink-700 rounded-xl">
            {[{ id: "todos", label: "Todos" }, ...TIPOS_PROVA].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipoFiltro(t.id)}
                className={cx(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200",
                  tipoFiltro === t.id
                    ? "bg-gold-400 text-ink-950"
                    : "text-ink-400 hover:text-ink-100",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <CampoSelect
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por ano"
          >
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </CampoSelect>

          <CampoSelect
            value={materiaFiltro}
            onChange={(e) => setMateriaFiltro(e.target.value)}
            className="!w-auto py-2 text-xs"
            aria-label="Filtrar por matéria"
          >
            <option value="todas">Todas as matérias</option>
            {materiasDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </CampoSelect>

          {temFiltroAtivo && (
            <Botao variante="fantasma" tamanho="sm" onClick={limparFiltros}>
              <FilterX size={14} /> Limpar
            </Botao>
          )}

          <span className="ml-auto text-xs text-ink-500 tabular-nums">
            {filtrados.length}{" "}
            {filtrados.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      {/* CONTEÚDO */}
      {carregando ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Esqueleto key={i} className="h-52" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EstadoVazio
          icone={Library}
          titulo={
            temFiltroAtivo
              ? "Nenhum material com esses filtros"
              : "A biblioteca ainda está vazia"
          }
          descricao={
            temFiltroAtivo
              ? "Ajuste a pesquisa ou limpe os filtros para ver tudo."
              : "Quando um professor publicar provas e materiais, eles aparecem aqui."
          }
          acao={
            temFiltroAtivo && (
              <Botao variante="secundario" tamanho="sm" onClick={limparFiltros}>
                <FilterX size={14} /> Limpar filtros
              </Botao>
            )
          }
        />
      ) : (
        <div className="space-y-12">
          {prateleiras.map(([ano, itensAno]) => {
            // Dentro do ano: Objetiva primeiro, depois Discursiva, depois o resto.
            const grupos = [
              ["objetiva", itensAno.filter((i) => i.tipoProva === "objetiva")],
              [
                "discursiva",
                itensAno.filter((i) => i.tipoProva === "discursiva"),
              ],
              [null, itensAno.filter((i) => !i.tipoProva)],
            ].filter(([, lista]) => lista.length > 0);

            return (
              <section key={ano}>
                <div className="flex items-baseline gap-3 mb-5">
                  <h2 className="font-display text-3xl font-black tracking-tight text-white tabular-nums">
                    {ano === "outros" ? "Outros materiais" : ano}
                  </h2>
                  <span className="text-xs text-ink-500 font-semibold">
                    {itensAno.length} {itensAno.length === 1 ? "item" : "itens"}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-white/[0.08] to-transparent" />
                </div>

                <div className="space-y-7">
                  {grupos.map(([tipoGrupo, lista]) => (
                    <div key={tipoGrupo ?? "geral"}>
                      {tipoGrupo && ano !== "outros" && (
                        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-3">
                          <Sparkles size={12} className="text-gold-500" />
                          Prova {rotuloTipo(tipoGrupo)}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence initial={false}>
                          {lista.map((item, i) => (
                            <CartaoProva key={item.id} item={item} indice={i} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
