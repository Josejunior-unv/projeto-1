import { useState } from 'react'

function StepVestibular3({ cronograma, onReset }) {
  const listaCronograma = Array.isArray(cronograma) ? cronograma : []

  return (
    <div
      className="flex items-center justify-center min-h-screen py-10 px-4"
      style={{
        backgroundImage: "url('/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      }}
    >
      <div className="bg-black bg-opacity-75 p-8 rounded-xl text-white w-full max-w-2xl backdrop-blur-sm">
        <h2 className="text-3xl font-bold mb-2 text-center text-green-400">Seu Cronograma de Estudos</h2>
        <p className="text-sm text-gray-300 text-center mb-6">
          Com base no seu vestibular e disponibilidade, esta é a divisão ideal de horas dedicadas por ciclo:
        </p>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-gray-700">
          {listaCronograma.map((materia) => {
            const horasNum = parseFloat(materia.horas) || 0

            return (
              <div key={materia.nome} className="bg-gray-900 bg-opacity-50 p-4 rounded-lg border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-lg text-gray-200">{materia.nome}</span>
                  <span className="text-sm font-bold bg-blue-600 bg-opacity-30 text-blue-400 px-3 py-1 rounded-full border border-blue-500 border-opacity-30">
                    {materia.horas}h
                  </span>
                </div>
                
                <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (horasNum / 15) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )
          })}

          {listaCronograma.length === 0 && (
            <p className="text-center text-gray-400 py-4">Nenhum dado de cronograma encontrado.</p>
          )}
        </div>

        <div className="flex justify-end gap-4 border-t border-gray-700 pt-4">
          <button 
            onClick={onReset}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors border border-gray-700"
          >
            Refazer Configurações
          </button>
        </div>
      </div>
    </div>
  )
}

export default StepVestibular3