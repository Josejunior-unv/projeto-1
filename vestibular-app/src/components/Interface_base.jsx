import { useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ListChecks,
  Timer,
  GraduationCap,
  Library,
  BarChart3,
  LogOut,
  Flame,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from "lucide-react";
import TarefasFeitas from "./Tarefas_Feitas";
import Home from "./Home";
import { BotaoTema } from "./ui";
import { usePersistedState } from "../hooks/usePersistedState";

// Carregamento sob demanda (code-splitting): as abas mais pesadas — Questões do
// ENEM, Estatísticas (recharts), Simulado e a Biblioteca — só são baixadas
// quando abertas.
const QuestoesHub = lazy(() => import("./QuestoesHub.jsx"));
const Estatisticas = lazy(() => import("./estatisticas.jsx"));
const Simulado = lazy(() => import("./simulado/Simulado.jsx"));
const BibliotecaProvas = lazy(() => import("./BibliotecaProvas.jsx"));

const Carregando = ({ texto = "Carregando..." }) => (
  <div className="mt-16 flex flex-col items-center gap-3 text-ink-400">
    <Loader2 size={22} className="animate-spin text-gold-400" />
    <span className="text-sm">{texto}</span>
  </div>
);

const MENU = [
  { aba: "cronograma", icone: LayoutDashboard, label: "Início" },
  { aba: "tarefas", icone: ListChecks, label: "Minhas Tarefas" },
  { aba: "simulados", icone: Timer, label: "Simulados" },
  { aba: "enem", icone: GraduationCap, label: "Questões" },
  { aba: "materiais", icone: Library, label: "Biblioteca UERJ" },
  { aba: "estatisticas", icone: BarChart3, label: "Estatísticas" },
];

const BotaoMenu = ({ ativo, onClick, icone: Icone, label, recolhida }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={ativo}
    title={recolhida ? label : undefined}
    className={`relative w-full flex items-center gap-3 rounded-xl text-sm font-semibold
                transition-colors duration-200 active:scale-[0.98] ${
                  recolhida ? "justify-center px-0 py-3" : "px-3.5 py-2.5"
                } ${
                  ativo
                    ? "text-gold-300"
                    : "text-ink-400 hover:text-ink-100 hover:bg-white/[0.04]"
                }`}
  >
    {ativo && (
      <motion.span
        layoutId="menu-ativo"
        className="absolute inset-0 rounded-xl bg-gold-400/10 border border-gold-400/20"
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
      />
    )}
    <Icone size={18} strokeWidth={2} className="relative z-10 shrink-0" />
    {!recolhida && <span className="relative z-10 truncate">{label}</span>}
  </button>
);

const ConteudoSidebar = ({
  abaAtiva,
  onSelecionar,
  onLogout,
  recolhida = false,
  onAlternarRecolhida,
}) => (
  <div className="flex flex-col h-full">
    {/* Marca */}
    <div
      className={`flex items-center mb-8 ${
        recolhida ? "justify-center" : "justify-between px-1"
      }`}
    >
      <div className="flex items-center gap-2.5 cursor-default min-w-0">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-gold-400 text-ink-950 flex items-center justify-center shadow-[var(--shadow-gold)]">
          <Flame size={18} strokeWidth={2.5} />
        </span>
        {!recolhida && (
          <div className="min-w-0 leading-tight">
            <p className="font-display font-black text-white text-sm tracking-tight truncate">
              UERJ Para Todos
            </p>
            <p className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold">
              Pré-Vestibular
            </p>
          </div>
        )}
      </div>
      {!recolhida && onAlternarRecolhida && (
        <button
          type="button"
          onClick={onAlternarRecolhida}
          title="Recolher menu"
          className="p-1.5 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-white/[0.05] transition-colors"
        >
          <PanelLeftClose size={16} />
        </button>
      )}
    </div>

    {recolhida && onAlternarRecolhida && (
      <button
        type="button"
        onClick={onAlternarRecolhida}
        title="Expandir menu"
        className="mb-4 mx-auto p-2 rounded-lg text-ink-500 hover:text-ink-200 hover:bg-white/[0.05] transition-colors"
      >
        <PanelLeftOpen size={16} />
      </button>
    )}

    <nav className="space-y-1 flex-1">
      {MENU.map((item) => (
        <BotaoMenu
          key={item.aba}
          ativo={abaAtiva === item.aba}
          onClick={() => onSelecionar(item.aba)}
          icone={item.icone}
          label={item.label}
          recolhida={recolhida}
        />
      ))}
    </nav>

    <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-1">
      <BotaoTema
        rotulo={!recolhida}
        className={recolhida ? "w-full justify-center py-3 rounded-xl" : ""}
      />
      <button
        type="button"
        onClick={onLogout}
        title={recolhida ? "Sair da conta" : undefined}
        className={`w-full flex items-center gap-3 rounded-xl text-sm font-semibold text-ink-400
                    hover:bg-rose-500/10 hover:text-rose-300 transition-colors duration-200 active:scale-[0.98] ${
                      recolhida ? "justify-center px-0 py-3" : "px-3.5 py-2.5"
                    }`}
      >
        <LogOut size={18} strokeWidth={2} className="shrink-0" />
        {!recolhida && "Sair da conta"}
      </button>
    </div>
  </div>
);

function InterfaceBase({ cronograma, userId, onLogout }) {
  const { aba } = useParams();
  const navigate = useNavigate();
  const abaAtiva = MENU.some((m) => m.aba === aba) ? aba : "cronograma";
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [sidebarRecolhida, setSidebarRecolhida] = usePersistedState(
    "sidebar_recolhida",
    false,
  );
  const listaCronograma = Array.isArray(cronograma) ? cronograma : [];

  const selecionarAba = (novaAba) => {
    navigate(`/app/${novaAba}`);
    setDrawerAberto(false); // fecha o drawer no mobile ao navegar
  };

  const tituloAba = MENU.find((m) => m.aba === abaAtiva)?.label ?? "";

  function renderConteudo() {
    switch (abaAtiva) {
      case "cronograma":
        return (
          <Home
            cronograma={listaCronograma}
            userId={userId}
            aoNavegar={selecionarAba}
          />
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
          <Suspense fallback={<Carregando texto="Abrindo as questões..." />}>
            <QuestoesHub userId={userId} />
          </Suspense>
        );

      case "materiais":
        return (
          <Suspense fallback={<Carregando texto="Abrindo a biblioteca..." />}>
            <BibliotecaProvas />
          </Suspense>
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
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-100">
      {/* SIDEBAR — DESKTOP (fixa: acompanha a rolagem do conteúdo) */}
      <aside
        className={`hidden lg:flex bg-ink-900 border-r border-white/[0.06] p-4 flex-col shrink-0 overflow-y-auto overflow-x-hidden
                    transition-[width] duration-300 ease-in-out ${
                      sidebarRecolhida ? "w-[76px]" : "w-64"
                    }`}
      >
        <ConteudoSidebar
          abaAtiva={abaAtiva}
          onSelecionar={selecionarAba}
          onLogout={onLogout}
          recolhida={sidebarRecolhida}
          onAlternarRecolhida={() => setSidebarRecolhida((v) => !v)}
        />
      </aside>

      {/* DRAWER — MOBILE */}
      <AnimatePresence>
        {drawerAberto && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerAberto(false)}
            />
            <motion.aside
              className="fixed top-0 left-0 bottom-0 w-72 max-w-[80%] bg-ink-900 border-r border-white/[0.06] p-5 z-50 lg:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-ink-900/80 backdrop-blur-md border-b border-white/[0.06]">
          <button
            type="button"
            onClick={() => setDrawerAberto(true)}
            aria-label="Abrir menu"
            className="p-2 rounded-lg text-ink-200 hover:bg-white/[0.06] active:scale-95 transition"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-white truncate flex-1">
            {tituloAba}
          </span>
          <BotaoTema />
        </header>

        <main className="flex-1 min-h-0 p-5 sm:p-8 lg:p-12 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={abaAtiva}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
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
