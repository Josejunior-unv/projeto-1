import { supabase } from "../SUPABASE";

// Acesso à tabela `noticias` (mural do administrador). Leituras são tolerantes:
// se a tabela ainda não existir, retornam lista vazia para não quebrar a UI.

export async function listarNoticias({ apenasPublicadas = true } = {}) {
  try {
    let consulta = supabase
      .from("noticias")
      .select("*")
      .order("prioridade", { ascending: false })
      .order("data_publicacao", { ascending: false })
      .order("criado_em", { ascending: false });

    if (apenasPublicadas) consulta = consulta.eq("publicado", true);

    const { data, error } = await consulta;
    if (error) return { data: [], error };
    return { data: data || [], error: null };
  } catch (error) {
    return { data: [], error };
  }
}

export async function criarNoticia(campos) {
  const { data, error } = await supabase
    .from("noticias")
    .insert([campos])
    .select()
    .single();
  return { data, error };
}

export async function atualizarNoticia(id, campos) {
  const { data, error } = await supabase
    .from("noticias")
    .update(campos)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

export async function excluirNoticia(id) {
  const { error } = await supabase.from("noticias").delete().eq("id", id);
  return { error };
}
