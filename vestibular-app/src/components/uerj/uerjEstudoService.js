import { supabase } from "../../SUPABASE";
import { areaPorId } from "../../constants/areasConhecimento";

/**
 * Coleta TODAS as linhas de uma consulta, paginando de 1000 em 1000.
 * O PostgREST do Supabase limita cada resposta a 1000 linhas — um
 * `.range(0, 4999)` devolve silenciosamente só as 1000 primeiras, o que
 * fazia filtros e contagens ignorarem metade do acervo.
 */
async function coletarTudo(montarConsulta, tamanho = 1000) {
  const linhas = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await montarConsulta().range(
      inicio,
      inicio + tamanho - 1,
    );
    if (error) return { data: linhas, error };
    linhas.push(...(data || []));
    if (!data || data.length < tamanho) return { data: linhas, error: null };
  }
}

// ============================================================
// Serviço de estudo do banco de questões da UERJ.
//
// • CONTEÚDO (questões/provas) vem do Supabase, com filtros e
//   paginação em duas etapas: primeiro os IDs que casam com os
//   filtros (leve), depois os detalhes só da página visível.
// • PROGRESSO do aluno (respostas, favoritas, revisar, tempo,
//   histórico de provas/simulados) fica em localStorage por
//   usuário — mesmo padrão do Simulado ENEM. As respostas com
//   gabarito também alimentam `questoes_respondidas` (Supabase),
//   então o dashboard geral de Estatísticas reflete tudo.
// ============================================================

/* ------------------------------------------------------------
   PROGRESSO LOCAL
   ------------------------------------------------------------ */

const chave = (userId) => `uerj_estudo_${userId || "anon"}`;
const chaveHistorico = (userId) => `uerj_historico_${userId || "anon"}`;

const VAZIO = { respostas: {}, favoritas: [], revisar: [] };

export function carregarEstudo(userId) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave(userId)));
    return { ...VAZIO, ...(dados || {}) };
  } catch {
    return { ...VAZIO };
  }
}

function salvarEstudo(userId, estudo) {
  try {
    localStorage.setItem(chave(userId), JSON.stringify(estudo));
  } catch {
    // Cota cheia: o progresso vale só na sessão.
  }
}

/** Registra a resposta de UMA questão. Devolve o estudo atualizado. */
export function registrarResposta(userId, questao, letra, tempoSegundos) {
  const estudo = carregarEstudo(userId);
  const temGabarito = !!questao.resposta;
  estudo.respostas[questao.id] = {
    letra,
    acertou: temGabarito ? letra === questao.resposta : null,
    tempo: Math.max(0, Math.round(tempoSegundos || 0)),
    data: new Date().toISOString().slice(0, 10),
    disciplina: questao.disciplina,
    assunto: questao.assunto,
  };
  salvarEstudo(userId, estudo);
  return estudo;
}

export function alternarMarcacao(userId, questaoId, lista) {
  // lista: 'favoritas' | 'revisar'
  const estudo = carregarEstudo(userId);
  const atual = new Set(estudo[lista]);
  if (atual.has(questaoId)) atual.delete(questaoId);
  else atual.add(questaoId);
  estudo[lista] = [...atual];
  salvarEstudo(userId, estudo);
  return estudo;
}

/* Histórico de provas completas e simulados. */
export function carregarHistoricoUerj(userId) {
  try {
    return JSON.parse(localStorage.getItem(chaveHistorico(userId))) || [];
  } catch {
    return [];
  }
}

export function salvarResultadoUerj(userId, resultado) {
  const historico = carregarHistoricoUerj(userId);
  historico.unshift({ ...resultado, data: new Date().toISOString() });
  try {
    localStorage.setItem(
      chaveHistorico(userId),
      JSON.stringify(historico.slice(0, 100)),
    );
  } catch {
    // sem espaço: segue sem persistir
  }
  return historico;
}

/** Resumo do progresso para o hub e o dashboard. */
export function resumoEstudo(userId) {
  const { respostas, favoritas, revisar } = carregarEstudo(userId);
  const lista = Object.values(respostas);
  const corrigidas = lista.filter((r) => r.acertou !== null);
  const acertos = corrigidas.filter((r) => r.acertou).length;

  // Sequência de dias consecutivos com atividade (terminando hoje/ontem).
  const dias = new Set(lista.map((r) => r.data));
  let sequencia = 0;
  const cursor = new Date();
  if (!dias.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1); // ainda não estudou hoje
  }
  while (dias.has(cursor.toISOString().slice(0, 10))) {
    sequencia++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const tempoTotal = lista.reduce((s, r) => s + (r.tempo || 0), 0);

  return {
    respondidas: lista.length,
    corrigidas: corrigidas.length,
    acertos,
    erros: corrigidas.length - acertos,
    taxa: corrigidas.length
      ? Math.round((acertos / corrigidas.length) * 100)
      : 0,
    favoritas: favoritas.length,
    revisar: revisar.length,
    sequencia,
    tempoTotal,
    tempoMedio: lista.length ? Math.round(tempoTotal / lista.length) : 0,
  };
}

/* ------------------------------------------------------------
   CONSULTAS DE CONTEÚDO (Supabase)
   ------------------------------------------------------------ */

export const FILTROS_STATUS = [
  { id: "todas", label: "Todas" },
  { id: "nao-respondidas", label: "Não respondidas" },
  { id: "respondidas", label: "Respondidas" },
  { id: "erradas", label: "Erradas" },
  { id: "favoritas", label: "Favoritas" },
  { id: "revisar", label: "Para revisar" },
];

/**
 * Etapa 1: IDs das questões que casam com os filtros (ordenados por
 * prova mais recente + número). Máx. ~2k linhas leves.
 */
export async function buscarIdsFiltrados(filtros = {}) {
  const montar = () => {
    let q = supabase
      .from("questoes_uerj")
      .select("id, imagens, prova:provas_uerj!inner(ano)")
      .order("prova_id", { ascending: false })
      .order("numero", { ascending: true });

    if (filtros.disciplina) q = q.eq("disciplina", filtros.disciplina);
    if (filtros.assunto) q = q.eq("assunto", filtros.assunto);
    if (filtros.dificuldade) q = q.eq("dificuldade", filtros.dificuldade);
    if (filtros.area) {
      const area = areaPorId(filtros.area);
      if (area) q = q.in("disciplina", area.disciplinas);
    }
    if (filtros.ano) q = q.eq("prova.ano", Number(filtros.ano));
    if (filtros.tipoProva) q = q.eq("prova.tipo", filtros.tipoProva);
    if (filtros.comGabarito) q = q.not("resposta", "is", null);
    if (filtros.busca?.trim()) {
      // Sanitiza os curingas/aspas do padrão ILIKE do PostgREST: a busca do
      // aluno é sempre texto literal, nunca sintaxe de padrão.
      const termo = filtros.busca.trim().slice(0, 120).replace(/[%_\\,"]/g, " ");
      q = q.ilike("enunciado", `%${termo}%`);
    }
    return q;
  };

  const { data, error } = await coletarTudo(montar);
  if (error) return { ids: [], error };

  let itens = data || [];
  if (filtros.comImagem) {
    itens = itens.filter((i) => Array.isArray(i.imagens) && i.imagens.length);
  }

  // Filtros de status usam o progresso local.
  if (filtros.status && filtros.status !== "todas" && filtros.userId != null) {
    const estudo = carregarEstudo(filtros.userId);
    const respondidas = new Set(Object.keys(estudo.respostas).map(Number));
    const erradas = new Set(
      Object.entries(estudo.respostas)
        .filter(([, r]) => r.acertou === false)
        .map(([id]) => Number(id)),
    );
    const favoritas = new Set(estudo.favoritas);
    const revisar = new Set(estudo.revisar);
    const testes = {
      "nao-respondidas": (id) => !respondidas.has(id),
      respondidas: (id) => respondidas.has(id),
      erradas: (id) => erradas.has(id),
      favoritas: (id) => favoritas.has(id),
      revisar: (id) => revisar.has(id),
    };
    const teste = testes[filtros.status];
    if (teste) itens = itens.filter((i) => teste(i.id));
  }

  return { ids: itens.map((i) => i.id), error: null };
}

/** Etapa 2: detalhes completos de um conjunto de IDs (uma página). */
export async function buscarQuestoesPorIds(ids) {
  if (!ids?.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from("questoes_uerj")
    .select(
      "*, prova:provas_uerj(id, ano, fase, tipo, titulo, pdf_url, url_original)",
    )
    .in("id", ids);
  // Preserva a ordem da lista de IDs.
  const porId = new Map((data || []).map((q) => [q.id, q]));
  return { data: ids.map((id) => porId.get(id)).filter(Boolean), error };
}

/** Valores distintos para os selects de filtro. */
export async function opcoesDeFiltro() {
  const [qs, provas] = await Promise.all([
    coletarTudo(() =>
      supabase.from("questoes_uerj").select("disciplina, assunto, dificuldade"),
    ),
    supabase.from("provas_uerj").select("ano").gt("ano", 0),
  ]);
  const questoes = qs.data || [];
  const unico = (arr) => [...new Set(arr.filter(Boolean))].sort();
  return {
    disciplinas: unico(questoes.map((q) => q.disciplina)).filter(
      (d) => d !== "Não Classificada",
    ),
    // Assuntos da disciplina escolhida são filtrados na tela; aqui vai o
    // conjunto completo com o vínculo disciplina→assuntos.
    assuntos: unico(questoes.map((q) => q.assunto)).filter(
      (a) => a !== "Não Classificado",
    ),
    assuntosPorDisciplina: questoes.reduce((mapa, q) => {
      if (!q.disciplina || !q.assunto || q.assunto === "Não Classificado")
        return mapa;
      (mapa[q.disciplina] ||= new Set()).add(q.assunto);
      return mapa;
    }, {}),
    anos: unico((provas.data || []).map((p) => p.ano)).reverse(),
    erro: qs.error || provas.error,
  };
}

/** Provas com contagem de questões (para a área Provas Completas). */
export async function listarProvasComQuestoes() {
  const [provasRes, questoesRes] = await Promise.all([
    supabase
      .from("provas_uerj")
      .select("*")
      .in("tipo", ["qualificacao", "discursivo", "gabarito", "padrao_resposta"])
      .order("ano", { ascending: false }),
    coletarTudo(() =>
      supabase.from("questoes_uerj").select("prova_id, resposta, disciplina"),
    ),
  ]);
  if (provasRes.error) return { provas: [], anexos: [], error: provasRes.error };

  const porProva = {};
  (questoesRes.data || []).forEach((q) => {
    const g = (porProva[q.prova_id] ||= {
      total: 0,
      comGabarito: 0,
      disciplinas: new Set(),
    });
    g.total++;
    if (q.resposta) g.comGabarito++;
    if (q.disciplina && q.disciplina !== "Não Classificada")
      g.disciplinas.add(q.disciplina);
  });

  const todas = provasRes.data || [];
  const provas = todas
    .filter((p) => ["qualificacao", "discursivo"].includes(p.tipo))
    .map((p) => ({
      ...p,
      questoes: porProva[p.id]?.total || 0,
      comGabarito: porProva[p.id]?.comGabarito || 0,
      disciplinas: [...(porProva[p.id]?.disciplinas || [])],
    }));
  // Gabaritos e padrões, para linkar pela edição (ano+fase[+disciplina]).
  const anexos = todas.filter((p) =>
    ["gabarito", "padrao_resposta"].includes(p.tipo),
  );
  return { provas, anexos, error: null };
}

export function acharAnexo(anexos, prova, tipo) {
  return (
    anexos.find(
      (a) =>
        a.tipo === tipo &&
        a.ano === prova.ano &&
        (a.fase || "") === (prova.fase || "") &&
        (!prova.disciplina || !a.disciplina || a.disciplina === prova.disciplina),
    ) || null
  );
}

/** Questões (com gabarito) de uma prova, prontas para o Executor. */
export async function questoesDaProva(provaId) {
  const { data, error } = await supabase
    .from("questoes_uerj")
    .select(
      "*, prova:provas_uerj(id, ano, fase, tipo, titulo, pdf_url, url_original)",
    )
    .eq("prova_id", provaId)
    .order("numero", { ascending: true });
  return { data: data || [], error };
}

/** Monta um simulado personalizado (só questões com gabarito). */
export async function montarSimulado({ quantidade = 10, ...filtros }) {
  const { ids, error } = await buscarIdsFiltrados({
    ...filtros,
    comGabarito: true,
  });
  if (error) return { data: [], error };
  const embaralhados = [...ids];
  for (let i = embaralhados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
  }
  return buscarQuestoesPorIds(embaralhados.slice(0, quantidade));
}

/** Denúncia de erro (classificação/gabarito). Precisa da parte 8 da migration. */
export async function denunciarQuestao(userId, questaoId, motivo) {
  const { error } = await supabase.from("uerj_import_logs").insert({
    nivel: "aviso",
    evento: "denuncia_questao",
    detalhes: { questao_id: questaoId, motivo: motivo?.slice(0, 300), usuario: userId },
  });
  return { error };
}
