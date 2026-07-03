import { supabase } from '../SUPABASE.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Interpreta 'YYYY-MM-DD' como data local (evita o deslocamento de fuso do
// construtor padrão do Date, que trata a string como UTC).
function paraData(str) {
    const [a, m, d] = String(str).split('-').map(Number);
    return new Date(a, (m || 1) - 1, d || 1);
}

// Segunda-feira da semana da data informada (início da semana).
function inicioSemana(dt) {
    const base = new Date(dt);
    const dia = (base.getDay() + 6) % 7; // 0 = segunda
    base.setDate(base.getDate() - dia);
    base.setHours(0, 0, 0, 0);
    return base;
}

const rotuloDia = (dt) =>
    `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
const rotuloMes = (dt) => `${MESES[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
const chaveMes = (dt) => `${dt.getFullYear()}-${dt.getMonth()}`;

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
        porMateria: {},
        semanas: {},
        meses: {},
        dias: new Set(),
    };

    data.forEach(q => {
        if (q.acertou) stats.acertos++;
        else stats.erros++;

        stats.dias.add(q.data);

        // Evolução diária (mantida por compatibilidade).
        if (!stats.evolucao[q.data]) stats.evolucao[q.data] = { acertos: 0, total: 0 };
        stats.evolucao[q.data].total++;
        if (q.acertou) stats.evolucao[q.data].acertos++;

        // Distribuição por matéria (contagem) + desempenho por matéria.
        stats.materias[q.materia] = (stats.materias[q.materia] || 0) + 1;
        if (!stats.porMateria[q.materia]) stats.porMateria[q.materia] = { acertos: 0, total: 0 };
        stats.porMateria[q.materia].total++;
        if (q.acertou) stats.porMateria[q.materia].acertos++;

        const dt = paraData(q.data);

        // Agrupamento semanal (segunda a domingo).
        const ini = inicioSemana(dt);
        const chaveS = ini.getTime();
        if (!stats.semanas[chaveS]) stats.semanas[chaveS] = { data: ini, acertos: 0, total: 0 };
        stats.semanas[chaveS].total++;
        if (q.acertou) stats.semanas[chaveS].acertos++;

        // Agrupamento mensal.
        const chaveM = chaveMes(dt);
        if (!stats.meses[chaveM]) stats.meses[chaveM] = { data: new Date(dt.getFullYear(), dt.getMonth(), 1), acertos: 0, total: 0 };
        stats.meses[chaveM].total++;
        if (q.acertou) stats.meses[chaveM].acertos++;
    });

    const taxaAcertoGeral = stats.total > 0 ? Number(((stats.acertos / stats.total) * 100).toFixed(1)) : 0;
    const diasAtivos = stats.dias.size;

    const porMateria = Object.keys(stats.porMateria)
        .map(m => ({
            name: m,
            total: stats.porMateria[m].total,
            acertos: stats.porMateria[m].acertos,
            pct: Math.round((stats.porMateria[m].acertos / stats.porMateria[m].total) * 100),
        }))
        .sort((a, b) => b.total - a.total);

    const melhorMateria = porMateria
        .filter(m => m.total >= 3)
        .sort((a, b) => b.pct - a.pct)[0] || null;

    // Últimas 8 semanas com atividade (mais antiga → mais recente).
    const semanal = Object.values(stats.semanas)
        .sort((a, b) => a.data - b.data)
        .slice(-8)
        .map(s => ({
            label: rotuloDia(s.data),
            acertos: s.acertos,
            erros: s.total - s.acertos,
            total: s.total,
            pct: Math.round((s.acertos / s.total) * 100),
        }));

    // Últimos 6 meses com atividade.
    const mensal = Object.values(stats.meses)
        .sort((a, b) => a.data - b.data)
        .slice(-6)
        .map(m => ({
            label: rotuloMes(m.data),
            acertos: m.acertos,
            erros: m.total - m.acertos,
            total: m.total,
            pct: Math.round((m.acertos / m.total) * 100),
        }));

    return {
        geral: {
            taxaAcerto: taxaAcertoGeral,
            totalQuestoes: stats.total,
            acertos: stats.acertos,
            erros: stats.erros,
            diasAtivos,
            mediaDia: diasAtivos ? Math.round(stats.total / diasAtivos) : 0,
            melhorMateria,
        },
        // Séries para os gráficos.
        semanal,
        mensal,
        porMateria,
        pizza: Object.keys(stats.materias).map(m => ({ name: m, value: stats.materias[m] })),
        evolucao: Object.keys(stats.evolucao).map(d => ({
            data: d,
            performance: Number(((stats.evolucao[d].acertos / stats.evolucao[d].total) * 100).toFixed(1)),
        })),
        ultimas: data.slice(-8).reverse().map(q => ({
            materia: q.materia,
            acertou: q.acertou,
            data: q.data,
        })),
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
 * Registra UMA questão respondida (usada na tela de Questões do ENEM e no
 * Simulado). Persiste no Supabase, na mesma tabela usada pela tela de
 * Estatísticas, de forma que o desempenho fica salvo permanentemente e as
 * estatísticas antigas nunca são perdidas (apenas inserimos, nunca apagamos).
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
