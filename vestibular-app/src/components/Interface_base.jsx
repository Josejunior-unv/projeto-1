import { useState } from 'react'

function InterfaceBase({ cronograma }) {
  const [abaAtiva, setAbaAtiva] = useState('cronograma')
  const listaCronograma = Array.isArray(cronograma) ? cronograma : []

  return (
    <div className="flex min-h-screen bg-gray-950 text-white font-sans selection:bg-blue-500 selection:text-white">
      
      {/* MENU LATERAL (SIDEBAR) */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col justify-between">
        <div>
          {/* Logo / Título */}
          <div className="flex items-center gap-2 mb-8 px-2 cursor-default group">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)] group-hover:scale-125 transition-all duration-300"></span>
            <span className="font-bold text-xl tracking-wide bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-indigo-300 transition-all duration-300">
              Portal do Estudante
            </span>
          </div>

          {/* Opções do Menu */}
          <nav className="space-y-2">
            <button
              onClick={() => setAbaAtiva('cronograma')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold 
                         transform transition-all duration-300 ease-in-out 
                         active:scale-95 hover:scale-[1.02] ${
                abaAtiva === 'cronograma'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-base">📊</span> Meu Cronograma
            </button>

            <button
              onClick={() => setAbaAtiva('tarefas')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold 
                         transform transition-all duration-300 ease-in-out 
                         active:scale-95 hover:scale-[1.02] ${
                abaAtiva === 'tarefas'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-base">✅</span> Minhas Tarefas
            </button>

            <button
              onClick={() => setAbaAtiva('simulados')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold 
                         transform transition-all duration-300 ease-in-out 
                         active:scale-95 hover:scale-[1.02] ${
                abaAtiva === 'simulados'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-bold'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-base">📝</span> Simulados & Notas
            </button>
          </nav>
        </div>

        {/* Rodapé do Menu */}
        <div className="text-xs text-gray-500 text-center border-t border-gray-800 pt-4 cursor-default">
          v1.0.0 — Painel de Estudos
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-10 overflow-y-auto bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
        
        {/* ABA: CRONOGRAMA */}
        {abaAtiva === 'cronograma' && (
          <div className="max-w-3xl transition-all duration-500">
            <div className="mb-6 cursor-default">
              <h1 className="text-3xl font-bold text-gray-100">Meu Planejamento Semanal</h1>
              <p className="text-sm text-gray-400 mt-1">Sua divisão de carga horária ideal para as disciplinas do vestibular.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listaCronograma.map((materia) => {
                const horasNum = parseFloat(materia.horas) || 0

                return (
                  <div 
                    key={materia.nome} 
                    className="bg-gray-900 bg-opacity-60 p-5 rounded-xl border border-gray-800 
                               transform transition-all duration-300 ease-in-out 
                               hover:scale-[1.03] hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 group"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-lg text-gray-200 group-hover:text-white transition-colors duration-300">
                        {materia.nome}
                      </span>
                      <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md 
                                     transform transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-105">
                        {materia.horas}h / ciclo
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 group-hover:from-blue-400 group-hover:to-indigo-400"
                        style={{ width: `${Math.min(100, (horasNum / 15) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ABA: TAREFAS */}
        {abaAtiva === 'tarefas' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-100">Lista de Tarefas</h1>
            <p className="text-sm text-gray-400 mt-1">Organize suas metas diárias de estudo.</p>
            <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-center text-gray-500 shadow-inner">
              🗂️ Espaço reservado para a sua futura lista de afazeres/Checklist!
            </div>
          </div>
        )}

        {/* ABA: SIMULADOS */}
        {abaAtiva === 'simulados' && (
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold text-gray-100">Desempenho em Simulados</h1>
            <p className="text-sm text-gray-400 mt-1">Acompanhe sua evolução nas provas anteriores.</p>
            <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-center text-gray-500 shadow-inner">
              📈 Espaço reservado para gráficos ou tabelas de notas de simulados!
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

export default InterfaceBase