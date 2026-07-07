import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Newspaper,
  Users,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "../SUPABASE";
import {
  MATERIAS,
  TIPOS_MATERIAL,
  TIPOS_UPLOAD,
  TIPOS_URL,
  coresDe,
} from "../constants/materias";
import {
  publicarMaterial,
  atualizarMaterial,
  listarMateriais,
  excluirMaterial,
  salvarOrdem,
} from "./materiaisService";
import { enviarArquivo, formatarTamanho } from "./storageService";
import GerenciarNoticias from "./GerenciarNoticias";
import GerenciarUsuarios from "./GerenciarUsuarios";
import { usePersistedState } from "../hooks/usePersistedState";

const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const tipoInfo = (id) =>
  TIPOS_MATERIAL.find((t) => t.id === id) || TIPOS_MATERIAL[0];

const FORM_VAZIO = { tipo: "pdf", titulo: "", url: "", descricao: "" };

export default function PainelAdmin() {
  const [secao, setSecao] = usePersistedState("admin_secao", "materiais");
  const [materiaAtiva, setMateriaAtiva] = usePersistedState(
    "admin_materia",
    MATERIAS[0].nome,
  );
  const [professorNome, setProfessorNome] = useState("");

  const [form, setForm] = useState(FORM_VAZIO);
  const [arquivo, setArquivo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const inputArquivoRef = useRef(null);

  const [materiais, setMateriais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [status, setStatus] = useState({ tipo: "", texto: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email || "";
      setProfessorNome(email ? email.split("@")[0] : "Professor");
    });
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const { data } = await listarMateriais(materiaAtiva);
      if (!ativo) return;
      setMateriais(data);
      setCarregando(false);
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [materiaAtiva]);

  const mostrarStatus = (tipoMsg, texto) => {
    setStatus({ tipo: tipoMsg, texto });
    setTimeout(() => setStatus({ tipo: "", texto: "" }), 4000);
  };

  const limparForm = () => {
    setForm(FORM_VAZIO);
    setArquivo(null);
    setEditandoId(null);
    setProgresso(null);
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  };

  const atualizarCampo = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  function iniciarEdicao(m) {
    setEditandoId(m.id);
    setForm({
      tipo: m.tipo || "pdf",
      titulo: m.titulo || "",
      url: TIPOS_URL.includes(m.tipo) ? m.url_arquivo || "" : "",
      descricao: m.descricao || "",
    });
    setArquivo(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { tipo, titulo, url, descricao } = form;

    if (!titulo.trim()) return mostrarStatus("erro", "Informe um título.");
    if (TIPOS_URL.includes(tipo) && !url.trim())
      return mostrarStatus("erro", "Informe a URL do link/vídeo.");
    if (TIPOS_UPLOAD.includes(tipo) && !editandoId && !arquivo)
      return mostrarStatus("erro", "Selecione o arquivo PDF.");

    setSalvando(true);
    const { data: userData } = await supabase.auth.getUser();
    const usuarioId = userData?.user?.id;

    // Upload do arquivo (se houver um novo).
    let infoArquivo = null;
    if (TIPOS_UPLOAD.includes(tipo) && arquivo) {
      try {
        setProgresso(0);
        infoArquivo = await enviarArquivo(arquivo, usuarioId, setProgresso);
      } catch (err) {
        setSalvando(false);
        setProgresso(null);
        return mostrarStatus("erro", err.message || "Falha no upload.");
      }
    }

    const camposArquivo = infoArquivo
      ? {
          url_arquivo: infoArquivo.url,
          storage_path: infoArquivo.caminho,
          arquivo_nome: infoArquivo.nome,
          arquivo_tamanho: infoArquivo.tamanho,
        }
      : {};

    if (editandoId) {
      const { data, error } = await atualizarMaterial(editandoId, {
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        url_arquivo: TIPOS_URL.includes(tipo) ? url.trim() : undefined,
        ...camposArquivo,
      });
      setSalvando(false);
      setProgresso(null);
      if (error) return mostrarStatus("erro", "Falha ao atualizar.");
      setMateriais((prev) => prev.map((m) => (m.id === editandoId ? data : m)));
      limparForm();
      return mostrarStatus("sucesso", "Material atualizado!");
    }

    const { data, error } = await publicarMaterial({
      usuarioId,
      professorNome,
      materia: materiaAtiva,
      tipo,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      url: TIPOS_URL.includes(tipo) ? url.trim() : infoArquivo?.url || "",
      storagePath: infoArquivo?.caminho || null,
      arquivoNome: infoArquivo?.nome || null,
      arquivoTamanho: infoArquivo?.tamanho || null,
    });

    setSalvando(false);
    setProgresso(null);
    if (error)
      return mostrarStatus(
        "erro",
        "Falha ao publicar. Você já rodou o supabase_migration.sql?",
      );

    setMateriais((prev) => [data, ...prev]);
    limparForm();
    mostrarStatus("sucesso", "Material publicado! Já aparece para os alunos.");
  }

  async function handleExcluir(m) {
    const anterior = materiais;
    setMateriais((prev) => prev.filter((x) => x.id !== m.id));
    const { error } = await excluirMaterial(m.id, m.storage_path);
    if (error) {
      setMateriais(anterior);
      mostrarStatus("erro", "Não foi possível excluir.");
    }
  }

  async function mover(indice, direcao) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= materiais.length) return;
    const nova = [...materiais];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    setMateriais(nova);
    await salvarOrdem(nova);
  }

  const cor = coresDe(MATERIAS.find((m) => m.nome === materiaAtiva)?.cor);
  const tipoAtual = form.tipo;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Painel do Professor
        </h1>
        <p className="text-ink-400 mt-1">
          Publique materiais por matéria — aparecem automaticamente em{" "}
          <span className="text-gold-400 font-semibold">Minhas Tarefas</span> dos
          alunos.
        </p>
      </motion.div>

      {/* Alternância de seção */}
      <div className="inline-flex p-1 rounded-2xl bg-ink-900/60 border border-ink-800 mb-6">
        {[
          { id: "materiais", label: "Materiais", icone: BookOpen },
          { id: "noticias", label: "Notícias", icone: Newspaper },
          { id: "usuarios", label: "Usuários", icone: Users },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSecao(s.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              secao === s.id
                ? "bg-gold-400 text-ink-950"
                : "text-ink-400 hover:text-white"
            }`}
          >
            <s.icone size={15} />
            {s.label}
          </button>
        ))}
      </div>

      {secao === "noticias" && <GerenciarNoticias autor={professorNome} />}

      {secao === "usuarios" && <GerenciarUsuarios />}

      {secao === "materiais" && (
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* MATÉRIAS */}
        <aside className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {MATERIAS.map((m) => {
            const ativo = m.nome === materiaAtiva;
            const c = coresDe(m.cor);
            return (
              <button
                key={m.nome}
                onClick={() => {
                  setMateriaAtiva(m.nome);
                  limparForm();
                }}
                aria-pressed={ativo}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  ativo
                    ? `${c.fundo} ${c.texto} border-current shadow-lg`
                    : "bg-ink-900/40 text-ink-400 border-ink-800 hover:text-white hover:border-ink-600"
                }`}
              >
                <span className="text-lg">{m.icone}</span>
                {m.nome}
              </button>
            );
          })}
        </aside>

        <section className="min-w-0">
          {/* FORMULÁRIO */}
          <motion.form
            key={materiaAtiva + (editandoId || "novo")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className={`p-6 rounded-3xl bg-ink-900/60 backdrop-blur-xl border ${cor.borda} shadow-2xl`}
          >
            <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <span className={cor.texto}>●</span>
              {editandoId ? "Editar material" : `Publicar em ${materiaAtiva}`}
            </h2>

            {/* Tipo */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TIPOS_MATERIAL.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => atualizarCampo("tipo", t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                    tipoAtual === t.id
                      ? "bg-gold-400 text-ink-950 border-gold-400 shadow-[var(--shadow-gold)]"
                      : "bg-ink-800/50 text-ink-300 border-ink-700 hover:border-gold-400/40"
                  }`}
                >
                  <span>{t.icone}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={form.titulo}
                onChange={(e) => atualizarCampo("titulo", e.target.value)}
                placeholder="Título (ex: Lista de Funções — Semana 1)"
                className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
              />

              {/* Upload (PDF) */}
              {TIPOS_UPLOAD.includes(tipoAtual) && (
                <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/40 p-4">
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-ink-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-gold-400 file:text-ink-950 hover:file:bg-gold-300 file:cursor-pointer cursor-pointer"
                  />
                  {arquivo && (
                    <p className="text-xs text-ink-400 mt-2">
                      {arquivo.name}{" "}
                      <span className="text-ink-600">
                        ({formatarTamanho(arquivo.size)})
                      </span>
                    </p>
                  )}
                  {editandoId && !arquivo && (
                    <p className="text-xs text-ink-600 mt-2">
                      Deixe em branco para manter o PDF atual, ou selecione um
                      novo para substituir.
                    </p>
                  )}
                  {progresso !== null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-ink-400 mb-1">
                        <span>Enviando...</span>
                        <span>{progresso}%</span>
                      </div>
                      <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gold-400"
                          animate={{ width: `${progresso}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* URL (link/vídeo) */}
              {TIPOS_URL.includes(tipoAtual) && (
                <input
                  value={form.url}
                  onChange={(e) => atualizarCampo("url", e.target.value)}
                  placeholder={
                    tipoAtual === "video"
                      ? "URL do vídeo (YouTube, etc.)"
                      : "URL do link"
                  }
                  className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
                />
              )}

              <textarea
                value={form.descricao}
                onChange={(e) => atualizarCampo("descricao", e.target.value)}
                placeholder="Descrição / instruções (opcional)"
                rows={3}
                className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition resize-y"
              />
            </div>

            <div className="flex items-center justify-between gap-4 mt-5 flex-wrap">
              <AnimatePresence>
                {status.texto && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-sm font-medium ${
                      status.tipo === "sucesso"
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {status.texto}
                  </motion.span>
                )}
              </AnimatePresence>

              <div className="flex gap-2 ml-auto">
                {editandoId && (
                  <button
                    type="button"
                    onClick={limparForm}
                    className="text-ink-400 hover:text-white font-bold py-3 px-5 rounded-xl border border-ink-700 transition active:scale-95"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={salvando}
                  className={`bg-gold-400 hover:bg-gold-300 text-ink-950 font-bold py-3 px-7 rounded-xl transition-all shadow-[var(--shadow-gold)] active:scale-95 ${
                    salvando ? "opacity-60 cursor-wait" : ""
                  }`}
                >
                  {salvando
                    ? "Salvando..."
                    : editandoId
                      ? "Salvar alterações"
                      : "Publicar material"}
                </button>
              </div>
            </div>
          </motion.form>

          {/* LISTA */}
          <div className="mt-6">
            <h3 className="text-ink-400 font-semibold mb-3 px-1">
              Publicados em {materiaAtiva}
            </h3>

            {carregando ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-ink-900/50 border border-ink-800 animate-pulse"
                  />
                ))}
              </div>
            ) : materiais.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-ink-800 text-center text-ink-500">
                Nenhum material publicado nesta matéria ainda.
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {materiais.map((m, indice) => (
                    <motion.li
                      key={m.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-start gap-3 p-4 rounded-2xl bg-ink-900/50 border border-ink-800 hover:border-ink-700 transition group"
                    >
                      {/* Reordenar */}
                      <div className="flex flex-col gap-1 pt-0.5">
                        <button
                          onClick={() => mover(indice, -1)}
                          disabled={indice === 0}
                          title="Subir"
                          className="text-ink-600 hover:text-white disabled:opacity-20 disabled:hover:text-ink-600 leading-none"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => mover(indice, 1)}
                          disabled={indice === materiais.length - 1}
                          title="Descer"
                          className="text-ink-600 hover:text-white disabled:opacity-20 disabled:hover:text-ink-600 leading-none"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>

                      <span className="text-2xl mt-0.5">
                        {tipoInfo(m.tipo).icone}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">
                            {m.titulo}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wide bg-ink-800 text-ink-300 px-2 py-0.5 rounded-md">
                            {tipoInfo(m.tipo).label}
                          </span>
                        </div>
                        {m.descricao && (
                          <p className="text-sm text-ink-400 mt-0.5 line-clamp-2">
                            {m.descricao}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-ink-600 mt-1">
                          <span>{formatarData(m.criado_em)}</span>
                          {m.arquivo_nome && (
                            <span className="text-ink-500">
                              · {m.arquivo_nome}
                              {m.arquivo_tamanho
                                ? ` (${formatarTamanho(m.arquivo_tamanho)})`
                                : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => iniciarEdicao(m)}
                          title="Editar"
                          className="text-ink-500 hover:text-gold-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleExcluir(m)}
                          title="Excluir"
                          className="text-ink-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
