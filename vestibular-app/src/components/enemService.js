// enemService.js

export async function buscarQuestoesDoAno(ano) {
  try {
    const resposta = await fetch(
      `https://api.enem.dev/v1/exams/${ano}/questions?limit=10`
    );

    if (!resposta.ok) {
      throw new Error(
        "Erro na requisição da API do ENEM"
      );
    }

    const dados = await resposta.json();

    // A API retorna { questions: [...] }
    return dados.questions || [];
  } catch (erro) {
    console.error(
      "Falha ao buscar dados do ENEM:",
      erro
    );

    return [];
  }
}
