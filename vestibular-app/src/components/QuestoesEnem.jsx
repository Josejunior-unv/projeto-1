import { useState, useEffect } from 'react';
import { buscarQuestoesDoAno } from './enemService';

function QuestoesEnem() {
  const [questoes, setQuestoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function iniciarCarga() {
      // Carregando ano de 2020 como teste inicial
      const dadosApi = await buscarQuestoesDoAno(2020);
      setQuestoes(dadosApi);
      setCarregando(false);
    }
    iniciarCarga();
  }, []);

  if (carregando) {
    return (
      <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-xl text-center text-blue-400 font-semibold animate-pulse">
        ⏳ Carregando questões oficiais do ENEM...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 mt-6">
      {questoes.map((questao) => (
        <div key={questao.index} className="bg-gray-900 bg-opacity-60 p-6 rounded-xl border border-gray-800 shadow-lg">
          {/* Cabeçalho da Questão */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
            <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-md">
              Questão {questao.index}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {questao.discipline} — {questao.year}
            </span>
          </div>

          {/* Enunciado */}
          <p className="text-gray-200 text-sm leading-relaxed mb-6 whitespace-pre-line">
            {questao.context}
          </p>

          {/* Lista de Alternativas */}
          <div className="flex flex-col gap-3">
            {questao.alternatives.map((alt) => (
              <button
                key={alt.letter}
                className="w-full text-left p-4 rounded-lg bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 text-sm text-gray-300 transition-all duration-200 hover:border-blue-500/50 hover:translate-x-1"
                onClick={() => alert(`Você marcou a alternativa ${alt.letter}. A resposta correta é: ${questao.correctAlternative}`)}
              >
                <strong className="text-blue-400 mr-2 uppercase">{alt.letter})</strong>
                {alt.text}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default QuestoesEnem;
