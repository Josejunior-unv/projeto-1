import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../SUPABASE";
import { PRIORIDADES, prioridadeDe } from "../constants/materias";
import {
  listarNoticias,
  criarNoticia,
  atualizarNoticia,
  excluirNoticia,
} from "./noticiasService";
import { enviarArquivo } from "./storageService";

const hoje = () => new Date().toISOString().split("T")[0];
const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const formVazio = () => ({
  titulo: "",
  descricao: "",
  link: "",
  imagem_url: "",
  prioridade: 0,
  data_publicacao: hoje(),
  publicado: true,
});

export default function GerenciarNoticias({ autor }) {
  const [noticias, setNoticias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(formVazio());
  const [editandoId, setEditandoId] = useState(null);
  const [imagemFile, setImagemFile] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [status, setStatus] = useState({ tipo: "", texto: "" });
  const inputImgRef = useRef(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      const { data } = await listarNoticias({ apenasPublicadas: false });
      if (!ativo) return;
      setNoticias(data);
      setCarregando(false);
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const mostrarStatus = (tipo, texto) => {
    setStatus({ tipo, texto });
    setTimeout(() => setStatus({ tipo: "", texto: "" }), 4000);
  };

  const set = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));

  const limpar = () => {
    setForm(formVazio());
    setEditandoId(null);
    setImagemFile(null);
    setProgresso(null);
    if (inputImgRef.current) inputImgRef.current.value = "";
  };

  function editar(n) {
    setEditandoId(n.id);
    setForm({
      titulo: n.titulo || "",
      descricao: n.descricao || "",
      link: n.link || "",
      imagem_url: n.imagem_url || "",
      prioridade: n.prioridade ?? 0,
      data_publicacao: n.data_publicacao || hoje(),
      publicado: n.publicado ?? true,
    });
    setImagemFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.titulo.trim()) return mostrarStatus("erro", "Informe um título.");

    setSalvando(true);
    const { data: userData } = await supabase.auth.getUser();

    // Upload da imagem (opcional).
    let imagemUrl = form.imagem_url;
    if (imagemFile) {
      try {
        setProgresso(0);
        const info = await enviarArquivo(
          imagemFile,
          userData?.user?.id,
          setProgresso,
        );
        imagemUrl = info.url;
      } catch (err) {
        setSalvando(false);
        setProgresso(null);
        return mostrarStatus("erro", err.message || "Falha no upload da imagem.");
      }
    }

    const campos = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      link: form.link.trim() || null,
      imagem_url: imagemUrl || null,
      prioridade: Number(form.prioridade),
      data_publicacao: form.data_publicacao,
      publicado: form.publicado,
      autor_nome: autor || "Admin",
    };

    if (editandoId) {
      const { data, error } = await atualizarNoticia(editandoId, campos);
      setSalvando(false);
      setProgresso(null);
      if (error) return mostrarStatus("erro", "Falha ao atualizar.");
      setNoticias((prev) => prev.map((n) => (n.id === editandoId ? data : n)));
      limpar();
      return mostrarStatus("sucesso", "Notícia atualizada!");
    }

    const { data, error } = await criarNoticia(campos);
    setSalvando(false);
    setProgresso(null);
    if (error)
      return mostrarStatus(
        "erro",
        "Falha ao criar. Você já rodou o supabase_migration.sql?",
      );
    setNoticias((prev) => [data, ...prev]);
    limpar();
    mostrarStatus("sucesso", "Notícia publicada!");
  }

  async function togglePublicado(n) {
    const { data, error } = await atualizarNoticia(n.id, {
      publicado: !n.publicado,
    });
    if (!error) setNoticias((prev) => prev.map((x) => (x.id === n.id ? data : x)));
  }

  async function excluir(id) {
    const anterior = noticias;
    setNoticias((prev) => prev.filter((n) => n.id !== id));
    const { error } = await excluirNoticia(id);
    if (error) {
      setNoticias(anterior);
      mostrarStatus("erro", "Não foi possível excluir.");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
      {/* FORM */}
      <motion.form
        key={editandoId || "nova"}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="p-6 rounded-3xl bg-ink-900/60 backdrop-blur-xl border border-gold-400/20 shadow-2xl h-fit"
      >
        <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
          <Newspaper size={18} className="text-gold-400" />{" "}
          {editandoId ? "Editar notícia" : "Nova notícia"}
        </h2>

        <div className="flex flex-col gap-3">
          <input
            value={form.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Título"
            className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
          />
          <textarea
            value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)}
            placeholder="Descrição / resumo"
            rows={3}
            className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition resize-y"
          />

          {/* Imagem (opcional) */}
          <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/40 p-4">
            <label className="text-xs font-semibold text-ink-400">
              Imagem (opcional)
            </label>
            <input
              ref={inputImgRef}
              type="file"
              accept="image/*"
              onChange={(e) => setImagemFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full text-sm text-ink-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-gold-400 file:text-ink-950 hover:file:bg-gold-300 file:cursor-pointer cursor-pointer"
            />
            {(imagemFile || form.imagem_url) && (
              <p className="text-xs text-ink-500 mt-2 truncate">
                {imagemFile ? imagemFile.name : "Imagem atual mantida"}
              </p>
            )}
            {progresso !== null && (
              <div className="w-full h-1.5 bg-ink-800 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full bg-gold-400"
                  animate={{ width: `${progresso}%` }}
                />
              </div>
            )}
          </div>

          <input
            value={form.link}
            onChange={(e) => set("link", e.target.value)}
            placeholder="Link (opcional)"
            className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition"
          />

          <div className="flex gap-3 flex-wrap">
            <select
              value={form.prioridade}
              onChange={(e) => set("prioridade", e.target.value)}
              className="flex-1 bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold-400/70 cursor-pointer"
            >
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  Prioridade: {p.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.data_publicacao}
              onChange={(e) => set("data_publicacao", e.target.value)}
              className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-3 text-ink-300 focus:outline-none focus:border-gold-400/70 cursor-pointer"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-ink-300 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => set("publicado", !form.publicado)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.publicado ? "bg-emerald-500" : "bg-ink-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  form.publicado ? "translate-x-5" : ""
                }`}
              />
            </button>
            {form.publicado ? "Publicada (visível aos alunos)" : "Oculta"}
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 mt-5 flex-wrap">
          <AnimatePresence>
            {status.texto && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-sm font-medium ${
                  status.tipo === "sucesso" ? "text-emerald-400" : "text-rose-400"
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
                onClick={limpar}
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
              {salvando ? "Salvando..." : editandoId ? "Salvar" : "Publicar"}
            </button>
          </div>
        </div>
      </motion.form>

      {/* LISTA */}
      <div>
        <h3 className="text-ink-400 font-semibold mb-3 px-1">
          Notícias ({noticias.length})
        </h3>
        {carregando ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-ink-900/50 border border-ink-800 animate-pulse"
              />
            ))}
          </div>
        ) : noticias.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-ink-800 text-center text-ink-500">
            Nenhuma notícia ainda.
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {noticias.map((n) => {
                const prio = prioridadeDe(n.prioridade);
                return (
                  <motion.li
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex gap-3 p-4 rounded-2xl bg-ink-900/50 border transition group ${
                      n.publicado ? "border-ink-800" : "border-ink-800 opacity-60"
                    }`}
                  >
                    {n.imagem_url && (
                      <img
                        src={n.imagem_url}
                        alt=""
                        loading="lazy"
                        className="w-16 h-16 rounded-xl object-cover border border-ink-800 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white truncate">
                          {n.titulo}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${prio.classe}`}
                        >
                          {prio.icone} {prio.label}
                        </span>
                        {!n.publicado && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-ink-800 text-ink-400">
                            oculta
                          </span>
                        )}
                      </div>
                      {n.descricao && (
                        <p className="text-sm text-ink-400 mt-0.5 line-clamp-2">
                          {n.descricao}
                        </p>
                      )}
                      <span className="text-xs text-ink-600">
                        {formatarData(n.data_publicacao)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => togglePublicado(n)}
                        title={n.publicado ? "Ocultar" : "Publicar"}
                        className="text-ink-500 hover:text-emerald-400 p-1"
                      >
                        {n.publicado ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        onClick={() => editar(n)}
                        title="Editar"
                        className="text-ink-500 hover:text-gold-400 p-1"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => excluir(n.id)}
                        title="Excluir"
                        className="text-ink-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
