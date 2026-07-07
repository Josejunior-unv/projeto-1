import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Download,
  Eye,
  Library,
  FilterX,
  Sparkles,
  PencilRuler,
  ArrowUpDown,
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
// BIBLIOTECA UERJ — ambiente exclusivo das provas da UERJ,
// independente de "Minhas Tarefas". Entram aqui apenas os
// materiais reconhecidos como PROVA: título/descrição com ano
// (ex.: 2026) ou com "UERJ". Prateleiras: Ano → Tipo (Objetiva /
// Discursiva) → Matéria. O professor só precisa nomear bem
// (ex.: "UERJ 2026 — Discursiva — Física").
// ------------------------------------------------------------

const TIPOS_PROVA = [
  { id: "objetiva", label: "Objetiva" },
  { id: "discursiva", label: "Discursiva" },
];

const ORDENACOES = [
  { id: "ano-desc", label: "Ano (recentes primeiro)" },
  { id: "ano-asc", label: "Ano (antigas primeiro)" },
  { id: "titulo", label: "Título (A–Z)" },
  { id: "publicacao", label: "Publicadas por último" },
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

// Uma prova é um material com ano identificado OU "UERJ" no texto.
const ehProva = (item) =>
  item.anoProva !== null || /uerj/i.test(`${item.titulo} ${item.descricao || ""}`);

const rotuloTipo = (id) =>
  TIPOS_PROVA.find((t) => t.id === id)?.label ?? "Prova";

/* Card individual de prova */
function CartaoProva({ item, indice }) {
  const infoMateria = MATERIAS.find((x) => x.nome === item.materia);
  const c = coresDe(infoMateria?.cor);
  const ehPdf = item.tipo === "pdf" || /\.pdf(\?|$)/i.test(item.url_arquivo || "");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(indice * 0.03, 0.25), duration: 0.3 }}
      className="group flex flex-col p-5 rounded-2xl bg-ink-900 border border-white/[0.08]
                 shadow-[var(--shadow-card)] transition-all duration-300
                 hover:border-gold-400/30 hover:-translate-y-1"
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
          <FileText size={20} strokeWidth={1.9} />
        </span>
        {item.anoProva && (
          <span className="font-display text-lg font-black text-ink-500 tabular-nums leading-none">
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

      {/* Espaço reservado: resolução online (futuro) */}
      <div
        className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-ink-500 select-none"
        title="Em breve você poderá resolver esta prova dentro da plataforma"
      >
        <PencilRuler size={12} />
        Resolver online
        <span className="ml-auto text-[10px] uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
          Em breve
        </span>
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
  const [ordenacao, setOrdenacao] = usePersistedState("bib_ordem", "ano-desc");

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

  // Só entram na biblioteca os materiais reconhecidos como prova.
  const provas = useMemo(
    () =>
      materiais
        .map((m) => ({
          ...m,
          anoProva: extrairAno(m),
          tipoProva: extrairTipo(m),
        }))
        .filter(ehProva),
    [materiais],
  );

  const anosDisponiveis = useMemo(
    () =>
      [...new Set(provas.map((i) => i.anoProva).filter(Boolean))].sort(
        (a, b) => b - a,
      ),
    [provas],
  );

  const materiasDisponiveis = useMemo(
    () => [...new Set(provas.map((i) => i.materia).filter(Boolean))],
    [provas],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = provas.filter((i) => {
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

    const porTitulo = (a, b) => (a.titulo || "").localeCompare(b.titulo || "");
    if (ordenacao === "titulo") return lista.sort(porTitulo);
    if (ordenacao === "publicacao")
      return lista.sort((a, b) => (b.criado_em || "").localeCompare(a.criado_em || ""));
    const dir = ordenacao === "ano-asc" ? 1 : -1;
    return lista.sort(
      (a, b) => ((a.anoProva ?? 0) - (b.anoProva ?? 0)) * dir || porTitulo(a, b),
    );
  }, [provas, busca, anoFiltro, materiaFiltro, tipoFiltro, ordenacao]);

  // Prateleiras por ano (ordem acompanha a ordenação escolhida).
  const prateleiras = useMemo(() => {
    const mapa = new Map();
    filtradas.forEach((i) => {
      const chave = i.anoProva ?? "sem-ano";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(i);
    });
    return [...mapa.entries()];
  }, [filtradas]);

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
        descricao="O acervo completo das provas da UERJ — organizado por ano, tipo e matéria."
        acoes={
          !carregando &&
          provas.length > 0 && (
            <Selo variante="ouro" className="text-xs">
              {provas.length} {provas.length === 1 ? "prova" : "provas"} ·{" "}
              {anosDisponiveis.length}{" "}
              {anosDisponiveis.length === 1 ? "ano" : "anos"}
            </Selo>
          )
        }
      />

      {/* BARRA DE FILTROS */}
      <div className="p-4 rounded-2xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-card)] mb-10 space-y-3">
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
            {[{ id: "todos", label: "Todas" }, ...TIPOS_PROVA].map((t) => (
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

          <label className="flex items-center gap-1.5" aria-label="Ordenar">
            <ArrowUpDown size={13} className="text-ink-500" />
            <CampoSelect
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              className="!w-auto py-2 text-xs"
            >
              {ORDENACOES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </CampoSelect>
          </label>

          {temFiltroAtivo && (
            <Botao variante="fantasma" tamanho="sm" onClick={limparFiltros}>
              <FilterX size={14} /> Limpar
            </Botao>
          )}

          <span className="ml-auto text-xs text-ink-500 tabular-nums">
            {filtradas.length}{" "}
            {filtradas.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </div>

      {/* CONTEÚDO */}
      {carregando ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Esqueleto key={i} className="h-56" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <EstadoVazio
          icone={Library}
          titulo={
            temFiltroAtivo
              ? "Nenhuma prova com esses filtros"
              : "O acervo ainda está sendo montado"
          }
          descricao={
            temFiltroAtivo
              ? "Ajuste a pesquisa ou limpe os filtros para ver todas as provas."
              : "As provas da UERJ aparecem aqui assim que forem publicadas pela equipe."
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
        <div className="space-y-14">
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
                <div className="flex items-baseline gap-3 mb-6">
                  <h2 className="font-display text-3xl font-black tracking-tight text-white tabular-nums">
                    {ano === "sem-ano" ? "UERJ" : ano}
                  </h2>
                  <span className="text-xs text-ink-500 font-semibold">
                    {itensAno.length}{" "}
                    {itensAno.length === 1 ? "prova" : "provas"}
                  </span>
                  <span className="flex-1 h-px bg-gradient-to-r from-white/[0.1] to-transparent" />
                </div>

                <div className="space-y-8">
                  {grupos.map(([tipoGrupo, lista]) => (
                    <div key={tipoGrupo ?? "geral"}>
                      {tipoGrupo && (
                        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-ink-500 mb-3.5">
                          <Sparkles size={12} className="text-gold-500" />
                          Prova {rotuloTipo(tipoGrupo)}
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
