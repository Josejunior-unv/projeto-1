import { supabase } from '../SUPABASE.js';

export async function processarEstatisticas(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
        .from('questoes_respondidas')
        .select('acertou, data, materia')
        .eq('usuario_id', userId)
        .order('data', { ascending: true });

    if (error || !data) return null;

    const stats = {
        total: data.length,
        acertos: 0,
        erros: 0,
        evolucao: {},
        materias: {}
    };

    data.forEach(q => {
        if (q.acertou) stats.acertos++;
        else stats.erros++;

        const dataFormatada = q.data;
        if (!stats.evolucao[dataFormatada]) stats.evolucao[dataFormatada] = { acertos: 0, total: 0 };
        stats.evolucao[dataFormatada].total++;
        if (q.acertou) stats.evolucao[dataFormatada].acertos++;

        stats.materias[q.materia] = (stats.materias[q.materia] || 0) + 1;
    });

    // Proteção contra divisão por zero se não houver questões
    const taxaAcertoGeral = stats.total > 0 ? ((stats.acertos / stats.total) * 100).toFixed(1) : 0;

    return {
        geral: {
            taxaAcerto: taxaAcertoGeral,
            totalQuestoes: stats.total
        },
        evolucao: Object.keys(stats.evolucao).map(data => ({
            data,
            performance: Number(((stats.evolucao[data].acertos / stats.evolucao[data].total) * 100).toFixed(1))
        })),
        pizza: Object.keys(stats.materias).map(m => ({
            name: m,
            value: stats.materias[m]
        }))
    };
}

export async function salvarSessaoEstudos(userId, acertos, erros, materia, dataSessao) {
    if (!userId) return { error: 'Usuário não autenticado' };

    // Formata a matéria (Ex: " cálculo " vira "Cálculo")
    const materiaNormalizada = materia
        .trim()
        .toLowerCase()
        .replace(/(^\w{1})|(\s+\w{1})/g, letra => letra.toUpperCase());

    // Usa a data fornecida ou a data de hoje (YYYY-MM-DD)
    const dataFinal = dataSessao || new Date().toISOString().split('T')[0]; 
    const novasQuestoes = [];

    for (let i = 0; i < acertos; i++) {
        novasQuestoes.push({ usuario_id: userId, acertou: true, materia: materiaNormalizada, data: dataFinal });
    }

    for (let i = 0; i < erros; i++) {
        novasQuestoes.push({ usuario_id: userId, acertou: false, materia: materiaNormalizada, data: dataFinal });
    }

    if (novasQuestoes.length === 0) return { error: 'Nenhuma questão para salvar' };

    const { data, error } = await supabase
        .from('questoes_respondidas')
        .insert(novasQuestoes);

    return { data, error };
}