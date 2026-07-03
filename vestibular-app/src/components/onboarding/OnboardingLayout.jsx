import { motion } from "framer-motion";

// Casca visual comum dos passos do onboarding: fundo, cartão central e o
// indicador de progresso (1 Vestibular → 2 Rotina → 3 Cronograma).
// Centraliza o layout para os três passos não repetirem estilo.

const PASSOS = [
  { n: 1, label: "Vestibular" },
  { n: 2, label: "Rotina" },
  { n: 3, label: "Cronograma" },
];

export default function OnboardingLayout({
  passo,
  titulo,
  subtitulo,
  children,
  largura = "max-w-2xl",
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center py-10 px-4"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`w-full ${largura} bg-gray-950/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 sm:p-8`}
      >
        {/* Stepper */}
        <div className="flex items-center justify-center mb-8">
          {PASSOS.map((p, i) => {
            const ativo = p.n === passo;
            const concluido = p.n < passo;
            return (
              <div key={p.n} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: ativo ? 1.1 : 1,
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                      concluido
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : ativo
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/40"
                          : "bg-gray-900 border-gray-700 text-gray-500"
                    }`}
                  >
                    {concluido ? "✓" : p.n}
                  </motion.div>
                  <span
                    className={`text-[11px] font-semibold ${
                      ativo ? "text-blue-300" : concluido ? "text-emerald-300" : "text-gray-500"
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
                {i < PASSOS.length - 1 && (
                  <div className="w-10 sm:w-16 h-0.5 mx-1 sm:mx-2 mb-5 rounded-full overflow-hidden bg-gray-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        p.n < passo ? "bg-emerald-500 w-full" : "bg-transparent w-0"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {titulo}
          </h2>
          {subtitulo && (
            <p className="text-sm text-gray-400 mt-2 max-w-lg mx-auto leading-relaxed">
              {subtitulo}
            </p>
          )}
        </div>

        {children}
      </motion.div>
    </div>
  );
}
