// Persistência e regras de negócio dos Simulados.
//
// Fonte de verdade: localStorage (por usuário) — escolhido por não exigir
// criação manual de tabela/coluna no Supabase e por funcionar 100% offline.
// O histórico NUNCA é apagado automaticamente. Um caminho de evolução futura é
// espelhar isto numa tabela `simulados` do Supabase para sincronizar entre
// dispositivos (ver relatório) — a API deste módulo já foi desenhada para isso.

const chave = (userId) => `simulados_hist_${userId || "anon"}`;
const chaveMeta = (userId) => `simulados_meta_${userId || "anon"}`;

const META_PADRAO = { simuladosPorSemana: 3 };

function ler(userId) {
  try {
    return JSON.parse(localStorage.getItem(chave(userId))) || [];
  } catch {
    return [];
  }
}

function escrever(userId, lista) {
  try {
    localStorage.setItem(chave(userId), JSON.stringify(lista));
  } catch {
    // ignora cota cheia
  }
}

// Histórico (mais recente primeiro).
export function carregarHistorico(userId) {
  return ler(userId)
    .slice()
    .sort((a, b) => new Date(b.dataISO) - new Date(a.dataISO));
}

export function salvarSimulado(userId, registro) {
  const lista = ler(userId);
  const completo = {
    id: registro.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dataISO: registro.dataISO || new Date().toISOString(),
    ...registro,
  };
  lista.push(completo);
  escrever(userId, lista);
  return completo;
}

export function medalhaDe(pct) {
  if (pct >= 90) return { id: "ouro", nome: "Ouro", icone: "🥇", cor: "text-amber-300" };
  if (pct >= 75) return { id: "prata", nome: "Prata", icone: "🥈", cor: "text-ink-300" };
  if (pct >= 60) return { id: "bronze", nome: "Bronze", icone: "🥉", cor: "text-orange-300" };
  return null;
}

// Meta semanal.
export function carregarMeta(userId) {
  try {
    return { ...META_PADRAO, ...JSON.parse(localStorage.getItem(chaveMeta(userId))) };
  } catch {
    return { ...META_PADRAO };
  }
}

export function salvarMeta(userId, meta) {
  try {
    localStorage.setItem(chaveMeta(userId), JSON.stringify(meta));
  } catch {
    // ignora
  }
}

function inicioSemana() {
  const d = new Date();
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function progressoMeta(historico, meta) {
  const ini = inicioSemana();
  const feitosSemana = historico.filter((s) => new Date(s.dataISO) >= ini).length;
  const alvo = meta.simuladosPorSemana || 3;
  return {
    feitos: feitosSemana,
    alvo,
    pct: Math.min(100, Math.round((feitosSemana / alvo) * 100)),
    concluida: feitosSemana >= alvo,
  };
}

// Ranking pessoal: melhores desempenhos (pct desc, depois menor tempo).
export function ranking(historico, limite = 5) {
  return historico
    .slice()
    .sort((a, b) => b.pct - a.pct || a.tempoSegundos - b.tempoSegundos)
    .slice(0, limite);
}

// Estatísticas agregadas do histórico.
export function resumoHistorico(historico) {
  if (historico.length === 0) {
    return { total: 0, melhorPct: 0, mediaPct: 0, ultimaPct: null };
  }
  const soma = historico.reduce((s, x) => s + x.pct, 0);
  return {
    total: historico.length,
    melhorPct: Math.max(...historico.map((x) => x.pct)),
    mediaPct: Math.round(soma / historico.length),
    // "última" no sentido cronológico (o histórico chega ordenado desc).
    ultimaPct: historico[0].pct,
  };
}

// Conquistas derivadas do histórico (nada é gravado — sempre recalculado).
export function conquistas(historico) {
  const totalSim = historico.length;
  const temOuro = historico.some((s) => s.pct >= 90);
  const notaMil = historico.some((s) => s.pct === 100);
  const bons = historico.filter((s) => s.pct >= 60).length;
  const grandes = historico.some((s) => s.totalQuestoes >= 20);
  const totalQuestoes = historico.reduce((s, x) => s + x.totalQuestoes, 0);

  return [
    { id: "primeiro", nome: "Primeiro Passo", icone: "🎯", desc: "Concluiu 1 simulado", ok: totalSim >= 1 },
    { id: "maratona", nome: "Maratonista", icone: "🏃", desc: "5 simulados concluídos", ok: totalSim >= 5 },
    { id: "dedicado", nome: "Dedicado", icone: "🔥", desc: "10 simulados concluídos", ok: totalSim >= 10 },
    { id: "foco", nome: "Foco Total", icone: "🧠", desc: "Um simulado com 20+ questões", ok: grandes },
    { id: "consistente", nome: "Consistente", icone: "📈", desc: "3 simulados com 60%+", ok: bons >= 3 },
    { id: "ouro", nome: "Medalha de Ouro", icone: "🥇", desc: "Tirou 90%+ em um simulado", ok: temOuro },
    { id: "milagre", nome: "Nota Mil", icone: "💯", desc: "Gabaritou um simulado", ok: notaMil },
    { id: "centuriao", nome: "Centurião", icone: "⚔️", desc: "100+ questões no total", ok: totalQuestoes >= 100 },
  ];
}

// Recomendações de estudo baseadas no desempenho por matéria acumulado.
export function recomendacoes(historico) {
  if (historico.length === 0) {
    return [
      { materia: "Comece agora", pct: null, texto: "Faça seu primeiro simulado para receber recomendações personalizadas." },
    ];
  }
  const agregado = {};
  historico.forEach((s) => {
    Object.entries(s.porMateria || {}).forEach(([mat, v]) => {
      if (!agregado[mat]) agregado[mat] = { acertos: 0, total: 0 };
      agregado[mat].acertos += v.acertos;
      agregado[mat].total += v.total;
    });
  });

  const areas = Object.entries(agregado)
    .filter(([, v]) => v.total >= 3)
    .map(([mat, v]) => ({ materia: mat, pct: Math.round((v.acertos / v.total) * 100), total: v.total }))
    .sort((a, b) => a.pct - b.pct);

  if (areas.length === 0) {
    return [{ materia: "Continue praticando", pct: null, texto: "Responda mais questões para gerar recomendações confiáveis." }];
  }

  return areas.slice(0, 3).map((a) => ({
    materia: a.materia,
    pct: a.pct,
    texto:
      a.pct < 50
        ? `Ponto de atenção: reforce ${a.materia}. Aproveitamento atual de ${a.pct}%.`
        : a.pct < 70
          ? `Você está evoluindo em ${a.materia} (${a.pct}%). Continue praticando para consolidar.`
          : `Ótimo domínio de ${a.materia} (${a.pct}%). Mantenha o ritmo!`,
  }));
}
