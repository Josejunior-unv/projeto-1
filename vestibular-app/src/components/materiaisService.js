import { supabase } from "../SUPABASE";
import { excluirArquivo } from "./storageService";

// Camada única de acesso à tabela `materiais_estudo`, usada pela área do
// professor (publicar/editar/excluir/reordenar) e pela área do aluno.

export async function publicarMaterial({
  usuarioId,
  professorNome,
  materia,
  tipo,
  titulo,
  descricao,
  url,
  storagePath = null,
  arquivoNome = null,
  arquivoTamanho = null,
}) {
  const { data, error } = await supabase
    .from("materiais_estudo")
    .insert([
      {
        usuario_id: usuarioId,
        professor_nome: professorNome,
        materia,
        tipo,
        titulo,
        descricao,
        url_arquivo: url,
        storage_path: storagePath,
        arquivo_nome: arquivoNome,
        arquivo_tamanho: arquivoTamanho,
        ordem: 0,
      },
    ])
    .select()
    .single();

  return { data, error };
}

export async function atualizarMaterial(id, campos) {
  const { data, error } = await supabase
    .from("materiais_estudo")
    .update(campos)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

export async function listarMateriais(materia) {
  let consulta = supabase
    .from("materiais_estudo")
    .select("*")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false });

  if (materia) consulta = consulta.eq("materia", materia);

  const { data, error } = await consulta;
  return { data: data || [], error };
}

export async function excluirMaterial(id, storagePath) {
  // Remove o arquivo do Storage (se houver) antes de apagar o registro.
  if (storagePath) await excluirArquivo(storagePath);

  const { error } = await supabase
    .from("materiais_estudo")
    .delete()
    .eq("id", id);

  return { error };
}

// Persiste a nova ordem de uma lista já reordenada (grava `ordem` = índice).
export async function salvarOrdem(itens) {
  const updates = itens.map((item, indice) =>
    supabase
      .from("materiais_estudo")
      .update({ ordem: indice })
      .eq("id", item.id),
  );
  await Promise.all(updates);
}
