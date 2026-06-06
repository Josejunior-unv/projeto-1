import { useState } from 'react';

function PainelAdmin() {
  
  const [area, setArea] = useState('geral');
  const [conteudo, setConteudo] = useState('');

 
  const handleSubmit = (e) => {
    e.preventDefault(); 
    
    console.log("Área selecionada:", area);
    console.log("Conteúdo digitado:", conteudo);
    alert(`Salvo com sucesso na área: ${area}`);
  };

  return (
    <div className="p-8 bg-gray-900 rounded-lg shadow-xl text-white w-full max-w-2xl mx-auto mt-10 border border-gray-800">
      <h2 className="text-3xl font-bold mb-6 text-blue-500">Painel do Administrador</h2>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        // PIT aq deu uma boa e vai dar certo
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-gray-300">Área de Atuação:</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="matematica">Matemática</option>
            <option value="fisica">Física</option>
            <option value="geral">Tanto faz (Geral)</option>
          </select>
        </label>

        
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-gray-300">Adicionar Novo Conteúdo:</span>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Digite a questão, enunciado ou dica aqui..."
            className="p-3 rounded bg-gray-800 text-white border border-gray-700 min-h-[150px] focus:border-blue-500 focus:outline-none resize-y"
          />
        </label>

        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md"
        >
          Salvar no Banco de Dados
        </button>
      </form>
    </div>
  );
}

export default PainelAdmin;