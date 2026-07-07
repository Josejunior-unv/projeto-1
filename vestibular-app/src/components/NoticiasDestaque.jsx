import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Newspaper, ArrowRight, ExternalLink } from "lucide-react";
import { prioridadeDe } from "../constants/materias";
import { listarNoticias } from "./noticiasService";
import { Botao, Modal, Selo } from "./ui";
import { cx } from "./ui/cx";

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
      <div className="flex items-center gap-2.5 mb-4">
        <Newspaper size={18} className="text-gold-400" />
        <h2 className="text-xl font-black text-white tracking-tight font-display">
          Novidades
        </h2>
      </div>

      {/* DESTAQUE */}
      <motion.button
        onClick={() => setAberta(destaque)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative w-full text-left overflow-hidden rounded-3xl border border-white/[0.08] shadow-[var(--shadow-card)] min-h-[200px] flex"
      >
        {destaque.imagem_url ? (
          <>
            <img
              src={destaque.imagem_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/10" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gold-400/15 via-ink-900 to-ink-950" />
        )}

        <div className="relative z-10 p-6 sm:p-8 mt-auto w-full">
          <div className="flex items-center gap-2 mb-2.5">
            <Selo variante="solido">Destaque</Selo>
            {destaque.prioridade > 0 && (
              <span
                className={cx(
                  "text-[11px] font-bold px-2.5 py-1 rounded-full",
                  prioridadeDe(destaque.prioridade).classe,
                )}
              >
                {prioridadeDe(destaque.prioridade).label}
              </span>
            )}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight font-display">
            {destaque.titulo}
          </h3>
          {destaque.descricao && (
            <p className="text-ink-200 mt-2 max-w-2xl line-clamp-2">
              {destaque.descricao}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4">
            <span className="text-xs text-ink-300">
              {formatarData(destaque.data_publicacao)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-300 group-hover:gap-2.5 transition-all">
              Ler mais <ArrowRight size={15} />
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
              className="group snap-start shrink-0 w-64 text-left rounded-2xl overflow-hidden bg-ink-900 border border-white/[0.06] hover:border-white/[0.14] hover:-translate-y-1 transition-all duration-300 shadow-[var(--shadow-card)]"
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
                <div className="h-28 bg-gradient-to-br from-ink-800 to-ink-900 flex items-center justify-center text-ink-500">
                  <Newspaper size={26} strokeWidth={1.5} />
                </div>
              )}
              <div className="p-4">
                {n.prioridade > 0 && (
                  <span
                    className={cx(
                      "inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-1.5",
                      prioridadeDe(n.prioridade).classe,
                    )}
                  >
                    {prioridadeDe(n.prioridade).label}
                  </span>
                )}
                <h4 className="font-bold text-white leading-snug line-clamp-2">
                  {n.titulo}
                </h4>
                <span className="text-[11px] text-ink-500 mt-1 block">
                  {formatarData(n.data_publicacao)}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* MODAL "LER MAIS" */}
      <Modal aberto={!!aberta} onFechar={() => setAberta(null)}>
        {aberta && (
          <>
            {aberta.imagem_url && (
              <img
                src={aberta.imagem_url}
                alt=""
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <h3 className="text-2xl font-black text-white font-display pr-8">
                {aberta.titulo}
              </h3>
              <span className="text-xs text-ink-500">
                {formatarData(aberta.data_publicacao)}
                {aberta.autor_nome ? ` · ${aberta.autor_nome}` : ""}
              </span>
              {aberta.descricao && (
                <p className="text-ink-200 leading-7 mt-4 whitespace-pre-line">
                  {aberta.descricao}
                </p>
              )}
              {aberta.link && (
                <Botao
                  as="a"
                  href={aberta.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5"
                >
                  <ExternalLink size={15} /> Acessar link
                </Botao>
              )}
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
