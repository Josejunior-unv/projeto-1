<<<<<<< HEAD
import { supabase } from '../SUPABASE.js';

export async function buscarestatisticas(userId) {
    if (!userId) return null;

    // 1. Busca todos os dados de uma vez
    const { data: questoes, error } = await supabase
        .from('questoes_respondidas')
        .select('materia, acertou')
        .eq('usuario_id', userId);

    if (error) { console.error(error); return null; }

    // 2. Cálculo denso: Agrupa matérias e conta acertos/erros
    const stats = {
        acertos: 0,
        erros: 0,
        materias: {}
    };

    (questoes || []).forEach(q => {
        // Conta acertos e erros globais
        if (q.acertou) stats.acertos++;
        else stats.erros++;

        // Agrupa para a Pizza: Conta quantas vezes cada matéria aparece
        if (q.materia) {
            stats.materias[q.materia] = (stats.materias[q.materia] || 0) + 1;
        }
    });

    // 3. Formata para o Recharts
    const dadosPizza = Object.keys(stats.materias).map(nome => ({
        name: nome,
        value: stats.materias[nome]
    }));

    return { 
        acertos: stats.acertos, 
        erros: stats.erros, 
        dadosPizza 
    };
}
=======
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
>>>>>>> eb32c19a8efc78eb2f089b2159e16f92ec292a48
