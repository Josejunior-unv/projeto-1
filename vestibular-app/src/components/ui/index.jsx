import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cx } from "./cx";

// ============================================================
// Kit de UI — UERJ Para Todos
// Primitivos visuais compartilhados por todas as telas.
// Identidade: tinta (ink) + ouro (gold). O CTA primário é a
// assinatura da marca: texto preto sobre ouro, como o selo
// "PARA TODOS" da logo.
// ============================================================

/* ---------------------------------------------------------- */
/* Botão                                                       */
/* ---------------------------------------------------------- */

const VARIANTES_BOTAO = {
  primario:
    "bg-gold-400 text-ink-950 font-bold hover:bg-gold-300 shadow-[var(--shadow-gold)] disabled:bg-ink-700 disabled:text-ink-400 disabled:shadow-none",
  secundario:
    "bg-ink-800 text-ink-100 font-semibold border border-ink-700 hover:border-ink-500 hover:text-white disabled:opacity-40",
  fantasma:
    "text-ink-300 font-semibold hover:text-white hover:bg-white/5 disabled:opacity-40",
  contorno:
    "border border-gold-400/40 text-gold-300 font-semibold hover:bg-gold-400/10 hover:border-gold-400/70 disabled:opacity-40",
  perigo:
    "bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-40",
};

const TAMANHOS_BOTAO = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-sm rounded-xl gap-2",
};

export function Botao({
  variante = "primario",
  tamanho = "md",
  className = "",
  as: Tag = "button",
  ...props
}) {
  return (
    <Tag
      {...(Tag === "button" ? { type: props.type || "button" } : {})}
      {...props}
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap select-none",
        "transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTES_BOTAO[variante],
        TAMANHOS_BOTAO[tamanho],
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- */
/* Cartão (superfície padrão)                                  */
/* ---------------------------------------------------------- */

export function Cartao({ className = "", interativo = false, ...props }) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-2xl bg-ink-900 border border-white/[0.06] shadow-[var(--shadow-card)]",
        interativo &&
          "transition-all duration-300 hover:border-white/[0.12] hover:-translate-y-0.5",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- */
/* Selo (badge)                                                */
/* ---------------------------------------------------------- */

const VARIANTES_SELO = {
  ouro: "bg-gold-400/10 text-gold-300 border-gold-400/25",
  neutro: "bg-white/[0.04] text-ink-300 border-white/[0.08]",
  sucesso: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  erro: "bg-rose-500/10 text-rose-300 border-rose-500/25",
  aviso: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  solido: "bg-gold-400 text-ink-950 border-gold-400 font-bold",
};

export function Selo({ variante = "neutro", className = "", ...props }) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold tracking-wide whitespace-nowrap",
        VARIANTES_SELO[variante],
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- */
/* Campos de formulário                                        */
/* ---------------------------------------------------------- */

const BASE_CAMPO =
  "w-full bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-ink-500 transition-colors duration-200 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40";

export function CampoTexto({ rotulo, className = "", ...props }) {
  const campo = (
    <input {...props} className={cx(BASE_CAMPO, className)} />
  );
  if (!rotulo) return campo;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-300">{rotulo}</span>
      {campo}
    </label>
  );
}

export function CampoArea({ rotulo, className = "", ...props }) {
  const campo = (
    <textarea {...props} className={cx(BASE_CAMPO, "resize-y", className)} />
  );
  if (!rotulo) return campo;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-300">{rotulo}</span>
      {campo}
    </label>
  );
}

export function CampoSelect({ rotulo, className = "", children, ...props }) {
  const campo = (
    <select {...props} className={cx(BASE_CAMPO, "cursor-pointer", className)}>
      {children}
    </select>
  );
  if (!rotulo) return campo;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-300">{rotulo}</span>
      {campo}
    </label>
  );
}

/* ---------------------------------------------------------- */
/* Alerta inline (erro/sucesso/aviso em formulários)           */
/* ---------------------------------------------------------- */

const VARIANTES_ALERTA = {
  erro: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  sucesso: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  aviso: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  neutro: "bg-white/[0.04] border-white/[0.08] text-ink-200",
};

export function Alerta({ variante = "neutro", className = "", ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      {...props}
      className={cx(
        "px-4 py-3 rounded-xl border text-sm font-medium",
        VARIANTES_ALERTA[variante],
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- */
/* Modal                                                       */
/* ---------------------------------------------------------- */

export function Modal({ aberto, onFechar, children, className = "" }) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onFechar}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={cx(
              "relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-pop)]",
              className,
            )}
          >
            {onFechar && (
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar"
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-ink-300 hover:text-white hover:bg-black/60 transition-colors"
              >
                <X size={16} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------------------------------- */
/* Estado vazio                                                */
/* ---------------------------------------------------------- */

export function EstadoVazio({ icone: Icone, titulo, descricao, acao, className = "" }) {
  return (
    <div
      className={cx(
        "p-10 sm:p-12 rounded-3xl border border-dashed border-ink-700 text-center",
        className,
      )}
    >
      {Icone && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-ink-400">
          <Icone size={26} strokeWidth={1.75} />
        </div>
      )}
      <p className="text-ink-100 font-semibold">{titulo}</p>
      {descricao && <p className="text-ink-400 text-sm mt-1 max-w-sm mx-auto">{descricao}</p>}
      {acao && <div className="mt-5 flex justify-center">{acao}</div>}
    </div>
  );
}

/* ---------------------------------------------------------- */
/* Skeleton                                                    */
/* ---------------------------------------------------------- */

export function Esqueleto({ className = "" }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-2xl bg-ink-800/80 border border-white/[0.04]",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------- */
/* Barra de progresso                                          */
/* ---------------------------------------------------------- */

export function BarraProgresso({
  valor = 0, // 0–100
  cor = "bg-gold-400",
  altura = "h-1.5",
  className = "",
}) {
  return (
    <div
      className={cx(
        "w-full rounded-full bg-white/[0.06] overflow-hidden",
        altura,
        className,
      )}
    >
      <motion.div
        className={cx("h-full rounded-full", cor)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/* ---------------------------------------------------------- */
/* Indicador estatístico (número + rótulo)                     */
/* ---------------------------------------------------------- */

export function Indicador({ valor, rotulo, cor = "text-white", className = "" }) {
  return (
    <div className={cx("text-center", className)}>
      <p className={cx("text-lg font-black leading-none font-display tabular-nums", cor)}>
        {valor}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold mt-1">
        {rotulo}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- */
/* Cabeçalho de página (título + subtítulo padronizados)       */
/* ---------------------------------------------------------- */

export function CabecalhoPagina({ titulo, descricao, acoes, className = "" }) {
  return (
    <div
      className={cx(
        "mb-8 flex items-end justify-between gap-4 flex-wrap",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl sm:text-[28px] font-black text-white tracking-tight font-display">
          {titulo}
        </h1>
        {descricao && <p className="text-sm text-ink-400 mt-1.5 max-w-xl">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </div>
  );
}
