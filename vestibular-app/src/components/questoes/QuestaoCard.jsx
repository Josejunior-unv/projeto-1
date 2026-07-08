import { motion, AnimatePresence } from "framer-motion";
import { Check, X, CheckCircle2, XCircle } from "lucide-react";
import { DIFICULDADES, nomeMateria } from "./questoesUtils.js";
import { Selo } from "../ui";
import { cx } from "../ui/cx";

// Renderiza UMA questão do ENEM (selos, enunciado, imagens, alternativas e,
// opcionalmente, o gabarito). Componente puro e reutilizável: é usado tanto na
// tela de Questões do ENEM quanto no Simulado.
//
// Props:
//  - questao        objeto da API do ENEM
//  - resposta       letra escolhida pelo usuário (ou undefined)
//  - onResponder    (letra) => void. Se ausente, as alternativas ficam só-leitura
//  - revelar        quando true, mostra certo/errado (verde/vermelho) + resultado
//  - dificuldade    chave em DIFICULDADES ('facil'|'media'|'dificil')
export default function QuestaoCard({
  questao,
  resposta,
  onResponder,
  revelar = false,
  dificuldade,
}) {
  const alternativas = questao.alternatives || [];
  const dif = DIFICULDADES[dificuldade] || null;
  const acertou = resposta === questao.correctAlternative;
  const bloqueado = !onResponder;

  return (
    <div className="bg-ink-900 border border-white/[0.06] rounded-2xl p-6 sm:p-7 shadow-[var(--shadow-card)]">
      {/* SELOS */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Selo variante="ouro">Questão {questao.index}</Selo>
          <Selo>{nomeMateria(questao)}</Selo>
          {dif && (
            <Selo title="Dificuldade estimada">
              <span className={cx("text-[8px]", dif.cor)}>●</span>
              {dif.label}
            </Selo>
          )}
        </div>
        <span className="text-xs text-ink-500 font-semibold tabular-nums">
          {questao.origem || "ENEM"} {questao.year}
        </span>
      </div>

      {/* ENUNCIADO */}
      {questao.context && (
        <div className="mb-6">
          <p className="text-ink-200 text-[15px] leading-7 whitespace-pre-line">
            {questao.context}
          </p>
        </div>
      )}

      {/* Comando/pergunta em destaque, quando a API fornece */}
      {questao.alternativesIntroduction && (
        <p className="text-white text-[15px] font-semibold leading-7 mb-6">
          {questao.alternativesIntroduction}
        </p>
      )}

      {/* IMAGENS DO ENUNCIADO */}
      {questao.files && questao.files.length > 0 && (
        <div className="flex flex-col gap-4 mb-6">
          {questao.files.map((imagem, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950"
            >
              <img
                src={imagem}
                alt={`Questão ${questao.index}`}
                loading="lazy"
                className="w-full object-contain"
              />
            </div>
          ))}
        </div>
      )}

      {/* ALTERNATIVAS */}
      <div className="flex flex-col gap-2.5" role="listbox" aria-label="Alternativas">
        {alternativas.map((alt) => {
          const correta = alt.letter === questao.correctAlternative;
          const selecionada = resposta === alt.letter;

          let estilo =
            "bg-white/[0.02] border-white/[0.07] hover:border-gold-400/40 hover:bg-white/[0.04]";
          let chip = "border-ink-600 text-ink-300 group-hover/alt:border-gold-400/50 group-hover/alt:text-gold-300";

          if (!revelar && selecionada) {
            // Modo simulado: destaca a escolha sem revelar o gabarito.
            estilo = "bg-gold-400/[0.07] border-gold-400/60";
            chip = "bg-gold-400 border-gold-400 text-ink-950 font-black";
          }
          if (revelar && selecionada && !correta) {
            estilo = "bg-rose-500/[0.07] border-rose-500/50";
            chip = "bg-rose-500 border-rose-500 text-white font-black";
          }
          if (revelar && correta) {
            estilo = "bg-emerald-500/[0.07] border-emerald-500/50";
            chip = "bg-emerald-500 border-emerald-500 text-white font-black";
          }

          return (
            <motion.button
              key={alt.letter}
              type="button"
              disabled={bloqueado || (revelar && !!resposta)}
              whileTap={!bloqueado ? { scale: 0.99 } : undefined}
              animate={revelar && correta ? { scale: [1, 1.01, 1] } : {}}
              transition={{ duration: 0.3 }}
              onClick={() => onResponder?.(alt.letter)}
              className={cx(
                "group/alt w-full text-left p-3.5 sm:p-4 rounded-xl border transition-colors duration-200",
                estilo,
                bloqueado && "cursor-default",
              )}
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={cx(
                    "w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center text-sm font-bold transition-colors duration-200",
                    chip,
                  )}
                >
                  {alt.letter}
                </span>
                <span className="text-sm leading-6 text-ink-200 pt-1 flex-1">
                  {alt.text}
                </span>
                {revelar && correta && (
                  <Check size={18} className="shrink-0 mt-1.5 text-emerald-400" />
                )}
                {revelar && selecionada && !correta && (
                  <X size={18} className="shrink-0 mt-1.5 text-rose-400" />
                )}
              </div>

              {alt.file && (
                <img
                  src={alt.file}
                  alt={`Alternativa ${alt.letter}`}
                  loading="lazy"
                  className="mt-4 ml-11 rounded-lg border border-white/[0.08]"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* RESULTADO (apenas quando revelar) */}
      <AnimatePresence>
        {revelar && resposta && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-6 pt-5 border-t border-white/[0.06] overflow-hidden"
          >
            {acertou ? (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-sm font-semibold">
                <CheckCircle2 size={17} className="shrink-0" />
                Você acertou a questão.
              </div>
            ) : (
              <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-sm font-semibold">
                <XCircle size={17} className="shrink-0" />
                Você errou. A resposta correta é a alternativa{" "}
                {questao.correctAlternative}.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
