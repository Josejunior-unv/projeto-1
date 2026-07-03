import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { prioridadeDe } from "../constants/materias";
import { listarNoticias } from "./noticiasService";

const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function NoticiasDestaque() {
  const [noticias, setNoticias] = useState([]);
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let ativo = true;
    listarNoticias({ apenasPublicadas: true }).then(({ data }) => {
      if (ativo) setNoticias(data);
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (noticias.length === 0) return null;

  const destaque = noticias[0];
  const resto = noticias.slice(1);

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📰</span>
        <h2 className="text-xl font-black text-white tracking-tight">Novidades</h2>
      </div>

      {/* DESTAQUE */}
      <motion.button
        onClick={() => setAberta(destaque)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative w-full text-left overflow-hidden rounded-3xl border border-white/10 shadow-2xl min-h-[200px] flex"
      >
        {destaque.imagem_url ? (
          <>
            <img
              src={destaque.imagem_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/10" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-slate-950" />
        )}

        <div className="relative z-10 p-6 sm:p-8 mt-auto w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
              ✨ Destaque
            </span>
            {destaque.prioridade > 0 && (
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${prioridadeDe(destaque.prioridade).classe}`}
              >
                {prioridadeDe(destaque.prioridade).icone}{" "}
                {prioridadeDe(destaque.prioridade).label}
              </span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {destaque.titulo}
          </h3>
          {destaque.descricao && (
            <p className="text-slate-300 mt-2 max-w-2xl line-clamp-2">
              {destaque.descricao}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <span className="text-xs text-slate-400">
              {formatarData(destaque.data_publicacao)}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-blue-300 group-hover:gap-2 transition-all">
              Ler mais →
            </span>
          </div>
        </div>
      </motion.button>

      {/* CARROSSEL DO RESTANTE */}
      {resto.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-3 mt-4 snap-x snap-mandatory [scrollbar-width:thin]">
          {resto.map((n, i) => (
            <motion.button
              key={n.id}
              onClick={() => setAberta(n)}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="group snap-start shrink-0 w-64 text-left rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800 hover:border-slate-600 hover:-translate-y-1 transition-all duration-300 shadow-lg"
            >
              {n.imagem_url ? (
                <div className="h-28 overflow-hidden">
                  <img
                    src={n.imagem_url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="h-28 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-3xl">
                  📰
                </div>
              )}
              <div className="p-4">
                {n.prioridade > 0 && (
                  <span
                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-1.5 ${prioridadeDe(n.prioridade).classe}`}
                  >
                    {prioridadeDe(n.prioridade).label}
                  </span>
                )}
                <h4 className="font-bold text-white leading-snug line-clamp-2">
                  {n.titulo}
                </h4>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {formatarData(n.data_publicacao)}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* MODAL "LER MAIS" */}
      <AnimatePresence>
        {aberta && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAberta(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {aberta.imagem_url && (
                <img
                  src={aberta.imagem_url}
                  alt=""
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-black text-white">
                    {aberta.titulo}
                  </h3>
                  <button
                    onClick={() => setAberta(null)}
                    className="text-slate-500 hover:text-white text-xl leading-none"
                  >
                    ✕
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  {formatarData(aberta.data_publicacao)}
                  {aberta.autor_nome ? ` · ${aberta.autor_nome}` : ""}
                </span>
                {aberta.descricao && (
                  <p className="text-slate-300 leading-7 mt-4 whitespace-pre-line">
                    {aberta.descricao}
                  </p>
                )}
                {aberta.link && (
                  <a
                    href={aberta.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95"
                  >
                    🔗 Acessar link
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
