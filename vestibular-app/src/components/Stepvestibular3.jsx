import { useState } from 'react'
import { supabase } from '../SUPABASE'

function StepVestibular3({ cronograma, onSaveSuccess }) {
  const [salvando, setSalvando] = useState(false)
  const listaCronograma = Array.isArray(cronograma) ? cronograma : []

  async function handleSalvarCronograma() {
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error("Usuário não encontrado")

      // Salva os dados na tabela do Supabase
      const { error } = await supabase
        .from('cronogramas')
        .upsert({ 
          user_id: user.id, 
          dados_cronograma: listaCronograma,
          updated_at: new Date()
        }, { onConflict: 'user_id' })

      if (error) throw error

      // Avisa o App.jsx para atualizar e abrir a InterfaceBase fixa!
      onSaveSuccess()
    } catch (error) {
      alert("Erro ao salvar cronograma: " + error.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen py-10 px-4">
      <div className="bg-black bg-opacity-75 p-8 rounded-xl text-white w-full max-w-2xl backdrop-blur-sm border border-gray-800 shadow-2xl">
        <h2 className="text-3xl font-bold mb-2 text-center text-blue-400">Seu Cronograma de Estudos</h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          Com base no seu vestibular e disponibilidade, esta é a divisão ideal de horas dedicadas por ciclo.
        </p>

        <div className="space-y-4 max-h-80 overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-gray-700">
          {listaCronograma.map((materia) => {
            const horasNum = parseFloat(materia.horas) || 0
            return (
              <div key={materia.nome} className="bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-lg text-gray-200">{materia.nome}</span>
                  <span className="text-sm font-bold bg-blue-600 bg-opacity-30 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">
                    {materia.horas}h
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (horasNum / 15) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-gray-800 pt-4">
          <button 
            onClick={handleSalvarCronograma}
            disabled={salvando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white font-extrabold py-3 px-6 rounded-lg 
                       transition-all duration-300 ease-in-out transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-600/20"
          >
            {salvando ? 'Salvando no seu perfil...' : '🚀 Salvar e Ir para o Painel Permanente'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StepVestibular3