import { useState, useEffect, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../SUPABASE";
import TarefasFeitas from "./Tarefas_Feitas";
import NoticiasDestaque from "./NoticiasDestaque";

// Carregamento sob demanda (code-splitting): as abas mais pesadas — Questões do
// ENEM e Estatísticas (que traz recharts) — só são baixadas quando abertas.
const QuestoesEnem = lazy(() => import("./QuestoesEnem"));
const Estatisticas = lazy(() => import("./estatisticas.jsx"));
const Simulado = lazy(() => import("./simulado/Simulado.jsx"));

const Carregando = ({ texto = "Carregando..." }) => (
  <div className="mt-8 text-center text-gray-500 animate-pulse">{texto}</div>
);

const MENU = [
  { aba: "cronograma", icone: "📊", label: "Meu Cronograma" },
  { aba: "tarefas", icone: "✅", label: "Minhas Tarefas" },
  { aba: "simulados", icone: "📝", label: "Simulados & Notas" },
  { aba: "enem", icone: "🎓", label: "Questões do ENEM" },
  { aba: "materiais", icone: "📂", label: "Materiais de Apoio" },
  { aba: "estatisticas", icone: "📈", label: "Estatísticas" },
];

const BotaoMenu = ({ ativo, onClick, icone, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={ativo}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold
                transform transition-all duration-300 ease-in-out active:scale-95 hover:scale-[1.02] ${
                  ativo
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
  >
    <span className="text-base">{icone}</span> {label}
  </button>
);

const ConteudoSidebar = ({ abaAtiva, onSelecionar, onLogout }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center gap-2 mb-8 px-2 cursor-default group">
      <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)] group-hover:scale-125 transition-all duration-300"></span>
      <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
        Portal do Estudante
      </span>
    </div>

    <nav className="space-y-2 flex-1">
      {MENU.map((item) => (
        <BotaoMenu
          key={item.aba}
          ativo={abaAtiva === item.aba}
          onClick={() => onSelecionar(item.aba)}
          icone={item.icone}
          label={item.label}
        />
      ))}
    </nav>

    <button
      type="button"
      onClick={onLogout}
      className="mt-6 w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-95"
    >
      <span className="text-base">🚪</span> Sair da Conta
    </button>
  </div>
);

function InterfaceBase({ cronograma, userId, onLogout }) {
  const { aba } = useParams();
  const navigate = useNavigate();
  const abaAtiva = MENU.some((m) => m.aba === aba) ? aba : "cronograma";
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const listaCronograma = Array.isArray(cronograma) ? cronograma : [];

  useEffect(() => {
    let isMounted = true;

    async function carregarMateriais() {
      const { data } = await supabase.from("materiais_estudo").select("*");
      if (isMounted && data) setMateriais(data);
    }
    carregarMateriais();

    const canal = supabase
      .channel("materiais_canal")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "materiais_estudo" },
        (payload) => setMateriais((prev) => [...prev, payload.new]),
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (canal && typeof canal.unsubscribe === "function") {
        canal.unsubscribe();
      } else if (canal) {
        supabase.removeChannel?.(canal);
      }
    };
  }, []);

  const selecionarAba = (novaAba) => {
    navigate(`/app/${novaAba}`);
    setDrawerAberto(false); // fecha o drawer no mobile ao navegar
  };

  const tituloAba = MENU.find((m) => m.aba === abaAtiva)?.label ?? "";

  function renderConteudo() {
    switch (abaAtiva) {
      case "cronograma":
        return (
          <div className="max-w-3xl">
            <NoticiasDestaque />
            <div className="mb-6 cursor-default">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">
                Meu Planejamento Semanal
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Sua divisão de carga horária ideal para as disciplinas do
                vestibular.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listaCronograma.map((materia) => {
                const horasNum = Number.parseFloat(materia.horas) || 0;
                const pct = Math.min(100, (horasNum / 15) * 100);
                return (
                  <div
                    key={materia.id ?? materia.nome}
                    className="bg-gray-900 bg-opacity-60 p-5 rounded-xl border border-gray-800
                               transform transition-all duration-300 ease-in-out
                               hover:scale-[1.03] hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 group"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-lg text-gray-200 group-hover:text-white transition-colors duration-300">
                        {materia.nome}
                      </span>
                      <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md transform transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105">
                        {materia.horas}h / ciclo
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <motion.div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case "tarefas":
        return <TarefasFeitas userId={userId} />;

      case "simulados":
        return (
          <Suspense fallback={<Carregando texto="Carregando simulados..." />}>
            <Simulado userId={userId} />
          </Suspense>
        );

      case "enem":
        return (
          <div className="max-w-3xl">
            <div className="mb-6 cursor-default">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">
                Banco de Questões ENEM
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Treine seus conhecimentos com o banco de dados oficial da
                comunidade.
              </p>
            </div>
            <Suspense fallback={<Carregando texto="Carregando questões..." />}>
              <QuestoesEnem userId={userId} />
            </Suspense>
          </div>
        );

      case "materiais":
        return (
          <div className="max-w-3xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">
              Materiais de Apoio
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              Arquivos e links disponibilizados para seus estudos.
            </p>
            <div className="grid gap-4">
              {(materiais || []).map((m) => (
                <a
                  key={m.id}
                  href={m.url_arquivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-900/60 p-5 rounded-xl border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800 transition-all group flex justify-between items-center"
                >
                  <span className="font-semibold text-gray-200 group-hover:text-white">
                    {m.titulo}
                  </span>
                  <span className="text-xs font-bold bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-md border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white">
                    Abrir
                  </span>
                </a>
              ))}
              {(!materiais || materiais.length === 0) && (
                <div className="p-8 rounded-xl border border-dashed border-gray-800 text-center text-gray-500">
                  Nenhum material de apoio disponível ainda.
                </div>
              )}
            </div>
          </div>
        );

      case "estatisticas":
        return (
          <Suspense fallback={<Carregando texto="Carregando estatísticas..." />}>
            <Estatisticas userId={userId} />
          </Suspense>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* SIDEBAR — DESKTOP (fixa: acompanha a rolagem do conteúdo) */}
      <aside className="hidden lg:flex w-64 bg-gray-900 border-r border-gray-800 p-6 flex-col justify-between shrink-0 overflow-y-auto">
        <ConteudoSidebar
          abaAtiva={abaAtiva}
          onSelecionar={selecionarAba}
          onLogout={onLogout}
        />
      </aside>

      {/* DRAWER — MOBILE */}
      <AnimatePresence>
        {drawerAberto && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerAberto(false)}
            />
            <motion.aside
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[80%] bg-gray-900 border-r border-gray-800 p-6 z-50 lg:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
            >
              <ConteudoSidebar
                abaAtiva={abaAtiva}
                onSelecionar={selecionarAba}
                onLogout={onLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
          <button
            type="button"
            onClick={() => setDrawerAberto(true)}
            aria-label="Abrir menu"
            className="p-2 rounded-lg text-gray-300 hover:bg-gray-800 active:scale-95 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-semibold text-gray-100 truncate">{tituloAba}</span>
        </header>

        <main className="flex-1 min-h-0 p-5 sm:p-8 lg:p-10 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={abaAtiva}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {renderConteudo()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default InterfaceBase;
