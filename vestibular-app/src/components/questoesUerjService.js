import { supabase } from "../SUPABASE";

// Camada única de acesso às provas/questões da UERJ importadas pelo
// pipeline (scripts/importador_uerj). Todas as funções degradam com
// elegância quando a migração ainda não foi executada (tabela ausente):
// devolvem listas vazias em vez de quebrar a tela.

export async function listarProvasUerj() {
  const { data, error } = await supabase
    .from("provas_uerj")
    .select("*")
    .order("ano", { ascending: false });
  return { data: data || [], error };
}

/** Contagem de questões por disciplina — alimenta as pastas do hub. */
export async function contarQuestoesPorDisciplina() {
  const { data, error } = await supabase
    .from("questoes_uerj")
    .select("disciplina");
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
  let consulta = supabase
    .from("questoes_uerj")
    .select("*, prova:provas_uerj(id, ano, fase, tipo, titulo, pdf_url)")
    .order("prova_id", { ascending: false })
    .order("numero", { ascending: true });

  if (disciplina) consulta = consulta.eq("disciplina", disciplina);

  const { data, error } = await consulta;
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
  const [provas, questoes] = await Promise.all([
    supabase.from("provas_uerj").select("id", { count: "exact", head: true }),
    supabase.from("questoes_uerj").select("id, classificada"),
  ]);
  if (provas.error || questoes.error) {
    return { erro: provas.error || questoes.error };
  }
  const lista = questoes.data || [];
  return {
    provas: provas.count || 0,
    questoes: lista.length,
    naoClassificadas: lista.filter((q) => !q.classificada).length,
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
