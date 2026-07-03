import { motion, AnimatePresence } from "framer-motion";
import { DIFICULDADES, nomeMateria } from "./questoesUtils.js";

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
    <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-6 sm:p-7 shadow-2xl">
      {/* SELOS */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg">
            Questão {questao.index}
          </span>
          <span className="text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-lg">
            {nomeMateria(questao)}
          </span>
          {dif && (
            <span
              className={`text-xs font-semibold bg-gray-800/60 border border-gray-700 px-2.5 py-1 rounded-lg ${dif.cor}`}
              title="Dificuldade estimada"
            >
              {dif.icone} {dif.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{questao.year}</span>
      </div>

      {/* ENUNCIADO */}
      {questao.context && (
        <div className="mb-6">
          <p className="text-gray-300 text-sm leading-7 whitespace-pre-line">
            {questao.context}
          </p>
        </div>
      )}

      {/* Comando/pergunta em destaque, quando a API fornece */}
      {questao.alternativesIntroduction && (
        <p className="text-gray-100 text-sm font-semibold leading-6 mb-6">
          {questao.alternativesIntroduction}
        </p>
      )}

      {/* IMAGENS DO ENUNCIADO */}
      {questao.files && questao.files.length > 0 && (
        <div className="flex flex-col gap-4 mb-6">
          {questao.files.map((imagem, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-gray-700 bg-black"
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
      <div className="flex flex-col gap-3">
        {alternativas.map((alt) => {
          const correta = alt.letter === questao.correctAlternative;
          const selecionada = resposta === alt.letter;

          let estilo =
            "bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-blue-500/40 hover:bg-gray-800/70";
          if (!revelar && selecionada) {
            // Modo simulado: destaca a escolha sem revelar o gabarito.
            estilo = "bg-blue-500/10 border-blue-500 text-blue-200";
          }
          if (revelar && selecionada && !correta) {
            estilo = "bg-red-500/10 border-red-500 text-red-300";
          }
          if (revelar && correta) {
            estilo = "bg-green-500/10 border-green-500 text-green-300";
          }

          return (
            <motion.button
              key={alt.letter}
              type="button"
              disabled={bloqueado || (revelar && !!resposta)}
              whileTap={!bloqueado ? { scale: 0.98 } : undefined}
              animate={revelar && correta ? { scale: [1, 1.015, 1] } : {}}
              transition={{ duration: 0.3 }}
              onClick={() => onResponder?.(alt.letter)}
              className={`w-full text-left p-4 sm:p-5 rounded-xl border transition-colors duration-200 ${estilo} ${
                bloqueado ? "cursor-default" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="font-bold text-blue-400">{alt.letter})</span>
                <span className="text-sm leading-6">{alt.text}</span>
                {revelar && correta && (
                  <span className="ml-auto text-green-400">✓</span>
                )}
                {revelar && selecionada && !correta && (
                  <span className="ml-auto text-red-400">✕</span>
                )}
                {!revelar && selecionada && (
                  <span className="ml-auto text-blue-400">●</span>
                )}
              </div>

              {alt.file && (
                <img
                  src={alt.file}
                  alt={`Alternativa ${alt.letter}`}
                  loading="lazy"
                  className="mt-4 rounded-lg border border-gray-700"
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
            className="mt-6 pt-5 border-t border-gray-800 overflow-hidden"
          >
            {acertou ? (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm font-semibold">
                ✅ Você acertou a questão.
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-semibold">
                ❌ Você errou. A resposta correta é {questao.correctAlternative}.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
