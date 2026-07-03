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
        materias: {},
        porMateria: {}
    };

    data.forEach(q => {
        if (q.acertou) stats.acertos++;
        else stats.erros++;

        const dataFormatada = q.data;
        if (!stats.evolucao[dataFormatada]) stats.evolucao[dataFormatada] = { acertos: 0, total: 0 };
        stats.evolucao[dataFormatada].total++;
        if (q.acertou) stats.evolucao[dataFormatada].acertos++;

        stats.materias[q.materia] = (stats.materias[q.materia] || 0) + 1;

        // Desempenho (acertos/total) por matéria
        if (!stats.porMateria[q.materia]) stats.porMateria[q.materia] = { acertos: 0, total: 0 };
        stats.porMateria[q.materia].total++;
        if (q.acertou) stats.porMateria[q.materia].acertos++;
    });

    // Proteção contra divisão por zero se não houver questões
    const taxaAcertoGeral = stats.total > 0 ? ((stats.acertos / stats.total) * 100).toFixed(1) : 0;

    return {
        geral: {
            taxaAcerto: taxaAcertoGeral,
            totalQuestoes: stats.total,
            acertos: stats.acertos,
            erros: stats.erros
        },
        evolucao: Object.keys(stats.evolucao).map(data => ({
            data,
            performance: Number(((stats.evolucao[data].acertos / stats.evolucao[data].total) * 100).toFixed(1))
        })),
        pizza: Object.keys(stats.materias).map(m => ({
            name: m,
            value: stats.materias[m]
        })),
        porMateria: Object.keys(stats.porMateria)
            .map(m => ({
                name: m,
                total: stats.porMateria[m].total,
                acertos: stats.porMateria[m].acertos,
                pct: Math.round((stats.porMateria[m].acertos / stats.porMateria[m].total) * 100)
            }))
            .sort((a, b) => b.total - a.total),
        // Últimas atividades (mais recentes primeiro)
        ultimas: data.slice(-8).reverse().map(q => ({
            materia: q.materia,
            acertou: q.acertou,
            data: q.data
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

/**
 * Registra UMA questão respondida (usada na tela de Questões do ENEM).
 * Persiste no Supabase, na mesma tabela usada pela tela de Estatísticas,
 * de forma que o desempenho fica salvo permanentemente e as estatísticas
 * antigas nunca são perdidas (apenas inserimos, nunca apagamos).
 */
export async function registrarRespostaEnem(userId, acertou, materia) {
    if (!userId) return { error: 'Usuário não autenticado' };

    const registro = {
        usuario_id: userId,
        acertou: !!acertou,
        materia: materia || 'ENEM',
        data: new Date().toISOString().split('T')[0],
    };

    const { data, error } = await supabase
        .from('questoes_respondidas')
        .insert([registro]);

    return { data, error };
}