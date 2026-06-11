import QuestoesEnem from "./QuestoesEnem";
import { useState, useEffect } from "react";
import { supabase } from "../SUPABASE";
import Estatisticas from "./estatisticas.jsx";
import TarefasFeitas from "./Tarefas_Feitas";

function InterfaceBase({ cronograma, userId }) {
  const [abaAtiva, setAbaAtiva] = useState("cronograma");
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
        // fallback para versões diferentes do client
        supabase.removeChannel?.(canal);
      }
    };
  }, []);

  const BotaoMenu = ({ aba, icone, label }) => (
    <button
      type="button"
      onClick={() => setAbaAtiva(aba)}
      aria-pressed={abaAtiva === aba}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold
                  transform transition-all duration-300 ease-in-out active:scale-95 hover:scale-[1.02] ${
                    abaAtiva === aba
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
    >
      <span className="text-base">{icone}</span> {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2 cursor-default group">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)] group-hover:scale-125 transition-all duration-300"></span>
            <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Portal do Estudante
            </span>
          </div>

          <nav className="space-y-2">
            <BotaoMenu aba="cronograma" icone="📊" label="Meu Cronograma" />
            <BotaoMenu aba="tarefas" icone="✅" label="Minhas Tarefas" />
            <BotaoMenu aba="simulados" icone="📝" label="Simulados & Notas" />
            <BotaoMenu aba="enem" icone="🎓" label="Questões do ENEM" />
            <BotaoMenu aba="materiais" icone="📂" label="Materiais de Apoio" />
            <BotaoMenu aba="estatisticas" icone="📈" label="Estatísticas" />
          </nav>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-10 overflow-y-auto bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
        {/* ABA: CRONOGRAMA */}
        {abaAtiva === "cronograma" && (
          <div className="max-w-3xl transition-all duration-500">
            <div className="mb-6 cursor-default">
              <h1 className="text-3xl font-bold text-gray-100">
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
                      <span
                        className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md
                                     transform transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105"
                      >
                        {materia.horas}h / ciclo
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 group-hover:from-blue-400 group-hover:to-indigo-400"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA: TAREFAS */}
        {abaAtiva === "tarefas" && (
          <>
            <TarefasFeitas />
          </>
        )}
        {/* ABA: SIMULADOS */}
        {abaAtiva === "simulados" && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-100">Simulados</h1>
            <p className="text-sm text-gray-400 mt-1">
              Acompanhe seu desempenho nos simulados.
            </p>
            <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-center text-gray-500 shadow-inner">
              📝 Em breve: seus simulados e notas!
            </div>
          </div>
        )}

        {/* ABA: ENEM */}
        {abaAtiva === "enem" && (
          <div className="max-w-3xl transition-all duration-500">
            <div className="mb-6 cursor-default">
              <h1 className="text-3xl font-bold text-gray-100">
                Banco de Questões ENEM
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Treine seus conhecimentos com o banco de dados oficial da
                comunidade.
              </p>
            </div>
            <QuestoesEnem />
          </div>
        )}

        {/* ABA: MATERIAIS */}
        {abaAtiva === "materiais" && (
          <div className="max-w-3xl animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
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
                    Baixar
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ABA: ESTATÍSTICAS */}
        {abaAtiva === "estatisticas" && <Estatisticas userId={userId} />}
      </main>
    </div>
  );
}

export default InterfaceBase;
