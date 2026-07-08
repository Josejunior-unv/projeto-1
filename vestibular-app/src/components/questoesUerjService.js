import { supabase } from "../SUPABASE";
import { areaDaDisciplina } from "../constants/areasConhecimento";

// Camada única de acesso às provas/questões da UERJ importadas pelo
// pipeline (scripts/importador_uerj). Todas as funções degradam com
// elegância quando a migração ainda não foi executada (tabela ausente):
// devolvem listas vazias em vez de quebrar a tela.

/**
 * Coleta TODAS as linhas de uma consulta, paginando de 1000 em 1000.
 * O PostgREST do Supabase limita cada resposta a 1000 linhas — consultas
 * sem paginação devolvem silenciosamente só as 1000 primeiras e faziam
 * contagens/filtros ignorarem parte do acervo.
 */
export async function coletarTudo(montarConsulta, tamanho = 1000) {
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

export async function listarProvasUerj() {
  const { data, error } = await supabase
    .from("provas_uerj")
    .select("*")
    .order("ano", { ascending: false });
  return { data: data || [], error };
}

/** Contagem de questões por disciplina — alimenta as pastas do hub. */
export async function contarQuestoesPorDisciplina() {
  const { data, error } = await coletarTudo(() =>
    supabase.from("questoes_uerj").select("disciplina"),
  );
  if (error) return { contagens: {}, total: 0, error };

  const contagens = {};
  (data || []).forEach((q) => {
    const d = q.disciplina || "Não Classificada";
    contagens[d] = (contagens[d] || 0) + 1;
  });
  return { contagens, total: data?.length || 0, error: null };
}

/** Questões de uma disciplina, com a prova de origem embutida. */
export async function listarQuestoesUerj(disciplina) {
  const montar = () => {
    let consulta = supabase
      .from("questoes_uerj")
      .select("*, prova:provas_uerj(id, ano, fase, tipo, titulo, pdf_url)")
      .order("prova_id", { ascending: false })
      .order("numero", { ascending: true });
    if (disciplina) consulta = consulta.eq("disciplina", disciplina);
    return consulta;
  };
  const { data, error } = await coletarTudo(montar);
  return { data: data || [], error };
}

/** Adapta uma questão UERJ para o formato que o QuestaoCard consome. */
export function adaptarParaCard(q) {
  return {
    index: q.numero,
    year: q.prova?.ano > 0 ? q.prova.ano : "",
    origem: "UERJ",
    materiaNome: q.disciplina,
    context: q.enunciado,
    files: Array.isArray(q.imagens) ? q.imagens : [],
    alternatives: (q.alternativas || []).map((a) => ({
      letter: a.letra,
      text: a.texto,
    })),
    correctAlternative: q.resposta || null,
  };
}

// ------------------------------------------------------------- admin

export async function estatisticasUerj() {
  const [provas, questoes, naoClassificadas] = await Promise.all([
    supabase.from("provas_uerj").select("id", { count: "exact", head: true }),
    supabase.from("questoes_uerj").select("id", { count: "exact", head: true }),
    supabase
      .from("questoes_uerj")
      .select("id", { count: "exact", head: true })
      .eq("classificada", false),
  ]);
  if (provas.error || questoes.error || naoClassificadas.error) {
    return { erro: provas.error || questoes.error || naoClassificadas.error };
  }
  return {
    provas: provas.count || 0,
    questoes: questoes.count || 0,
    naoClassificadas: naoClassificadas.count || 0,
    erro: null,
  };
}

export async function listarLogsUerj(limite = 30) {
  const { data, error } = await supabase
    .from("uerj_import_logs")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limite);
  return { data: data || [], error };
}

export async function listarNaoClassificadas(limite = 50) {
  const { data, error } = await supabase
    .from("questoes_uerj")
    .select("id, numero, enunciado, disciplina, assunto, prova:provas_uerj(ano, fase)")
    .eq("classificada", false)
    .limit(limite);
  return { data: data || [], error };
}

export async function corrigirClassificacao(id, disciplina, assunto) {
  const { error } = await supabase
    .from("questoes_uerj")
    .update({
      disciplina,
      assunto: assunto || "Não Classificado",
      // Mantém a área coerente com a disciplina corrigida.
      area: areaDaDisciplina(disciplina)?.nome ?? null,
      classificada: true,
    })
    .eq("id", id);
  return { error };
}

export async function excluirProvaUerj(id) {
  // As questões caem junto (FK on delete cascade).
  const { error } = await supabase.from("provas_uerj").delete().eq("id", id);
  return { error };
}
