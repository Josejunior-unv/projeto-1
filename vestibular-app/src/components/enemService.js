// Função que conecta com a API pública enem.dev
export async function buscarQuestoesDoAno(ano) {
  try {
    // Buscamos as questões do ano escolhido limitando a 10 para teste rápido
    const resposta = await fetch(`https://api.enem.dev/v1/exams/${ano}/questions?limit=10`);

    if (!resposta.ok) {
      throw new Error("Erro na requisição da API do ENEM");
    }

    const dados = await resposta.json();
    return dados.questions; // Retorna apenas a lista de questões tratadas
  } catch (erro) {
    console.error("Falha ao buscar dados do ENEM:", erro);
    return []; // Retorna lista vazia para o app não quebrar se a API cair
  }
}
