import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  BUCKET_MATERIAIS,
} from "../SUPABASE";

// Remove acentos/espaços para um nome de arquivo seguro no Storage.
function sanitizar(nome) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export function urlPublica(caminho) {
  const { data } = supabase.storage
    .from(BUCKET_MATERIAIS)
    .getPublicUrl(caminho);
  return data?.publicUrl || "";
}

/**
 * Envia um arquivo para o Supabase Storage com barra de progresso REAL
 * (via XMLHttpRequest, que expõe o evento de upload — o SDK não expõe).
 * Resolve com { caminho, url, nome, tamanho }.
 */
export async function enviarArquivo(file, userId, onProgress) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  const caminho = `${userId || "anon"}/${Date.now()}-${sanitizar(file.name)}`;
  const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET_MATERIAIS}/${caminho}`;

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `Erro ${xhr.status} ao enviar`;
        try {
          msg = JSON.parse(xhr.responseText).message || msg;
        } catch {
          // resposta não-JSON; mantém a mensagem padrão
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Falha de rede ao enviar o arquivo."));

    xhr.send(file);
  });

  return {
    caminho,
    url: urlPublica(caminho),
    nome: file.name,
    tamanho: file.size,
  };
}

export async function excluirArquivo(caminho) {
  if (!caminho) return { error: null };
  const { error } = await supabase.storage
    .from(BUCKET_MATERIAIS)
    .remove([caminho]);
  return { error };
}

// Formata bytes para leitura humana (KB, MB...).
export function formatarTamanho(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
