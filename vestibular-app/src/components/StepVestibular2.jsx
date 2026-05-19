import { useState } from 'react'
import { materias as listaInicialMaterias, calcularCronograma } from './logica.js'

function StepVestibular2({ onNext }) {
  const [dias, setDias] = useState(5)
  const [horas, setHoras] = useState(4)
  const [pesosMaterias, setPesosMaterias] = useState(
    listaInicialMaterias.map(m => ({ ...m, peso: 1 }))
  )

  const handlePesoChange = (index, novoPeso) => {
    const novasMaterias = [...pesosMaterias]
    novasMaterias[index].peso = parseInt(novoPeso) || 1
    setPesosMaterias(novasMaterias)
  }

  const handleFinalizar = () => {
    const cronogramaGerado = calcularCronograma(dias, horas, pesosMaterias)
    
    onNext({
      cronograma: cronogramaGerado
    })
  }

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
        <h2 className="text-3xl font-bold mb-2 text-center text-blue-400">Configurações de Estudo</h2>
        <p className="text-sm text-gray-300 text-center mb-6">
          Defina sua rotina e o nível de dificuldade de cada disciplina (1 = Mais Fácil, 5 = Mais Difícil).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-900 bg-opacity-50 p-4 rounded-lg">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-200">Dias de estudo por semana:</label>
            <input 
              type="number" 
              min="1" 
              max="7" 
              value={dias} 
              onChange={(e) => setDias(Math.min(7, Math.max(1, parseInt(e.target.value) || 1)))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-200">Horas de estudo por dia:</label>
            <input 
              type="number" 
              min="1" 
              max="24" 
              value={horas} 
              onChange={(e) => setHoras(Math.min(24, Math.max(1, parseInt(e.target.value) || 1)))}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <h3 className="text-xl font-semibold mb-3 text-gray-200 border-b border-gray-700 pb-1">Pesos das Matérias</h3>
        
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2 mb-6 scrollbar-thin scrollbar-thumb-gray-700">
          {pesosMaterias.map((materia, index) => (
            <div key={materia.nome} className="flex items-center justify-between bg-gray-900 bg-opacity-40 p-3 rounded-lg hover:bg-opacity-60 transition">
              <span className="font-medium text-gray-200">{materia.nome}</span>
              <select
                value={materia.peso}
                onChange={(e) => handlePesoChange(index, e.target.value)}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="1">1 (Muito Fácil)</option>
                <option value="2">2 (Fácil)</option>
                <option value="3">3 (Média)</option>
                <option value="4">4 (Difícil)</option>
                <option value="5">5 (Muito Difícil)</option>
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-4 mt-4 border-t border-gray-700 pt-4">
          <button 
            onClick={handleFinalizar}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            Gerar Meu Cronograma
          </button>
        </div>
      </div>
    </div>
  )
}

export default StepVestibular2