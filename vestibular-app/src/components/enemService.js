// Serviço responsável por conversar com a API pública do ENEM (api.enem.dev).

const API_BASE = "https://api.enem.dev/v1";

// A API limita cada requisição a no máximo 50 questões por página.
const LIMITE_POR_PAGINA = 50;

/**
 * Identificador único e estável de uma questão.
 * Combina ano + área + idioma + índice porque a API pode devolver:
 *  - a MESMA questão em páginas diferentes (o offset é inclusivo, então cada
 *    limite de página repete 1 questão — índices 50, 100, 150...);
 *  - questões DIFERENTES com o mesmo índice (variantes de Inglês e Espanhol
 *    compartilham os índices 1–5).
 * Usar só `ano-índice` gerava chaves de React duplicadas e quebrava a resposta
 * dessas questões.
 */
export function idQuestao(q) {
  return `${q.year}-${q.discipline || "geral"}-${q.language || "x"}-${q.index}`;
}

/**
 * Busca uma única página de questões de um ano.
 * Mantida por compatibilidade e usada internamente pela paginação.
 */
export async function buscarQuestoesDoAno(ano, { limit = 10, offset = 0 } = {}) {
  const resposta = await fetch(
    `${API_BASE}/exams/${ano}/questions?limit=${limit}&offset=${offset}`
  );

  if (!resposta.ok) {
    throw new Error("Erro na requisição da API do ENEM");
  }

  const dados = await resposta.json();

  // A API retorna { metadata: {...}, questions: [...] }
  return dados;
}

/**
 * Busca TODAS as questões de um ano, percorrendo todas as páginas.
 * Necessário para que o filtro por matéria tenha questões de todas as áreas
 * (a prova é ordenada por área, então buscar só a 1ª página traria apenas
 * Linguagens). As páginas seguintes são carregadas em paralelo.
 */
export async function buscarTodasQuestoesDoAno(ano) {
  try {
    // 1ª página: também nos diz o total de questões existentes.
    const primeira = await buscarQuestoesDoAno(ano, {
      limit: LIMITE_POR_PAGINA,
      offset: 0,
    });

    const total = primeira?.metadata?.total ?? 0;
    let questoes = primeira?.questions ?? [];

    // Monta os offsets restantes e busca em paralelo.
    const offsetsRestantes = [];
    for (let off = LIMITE_POR_PAGINA; off < total; off += LIMITE_POR_PAGINA) {
      offsetsRestantes.push(off);
    }

    if (offsetsRestantes.length > 0) {
      const paginas = await Promise.all(
        offsetsRestantes.map((offset) =>
          buscarQuestoesDoAno(ano, { limit: LIMITE_POR_PAGINA, offset })
        )
      );
      paginas.forEach((pag) => {
        questoes = questoes.concat(pag?.questions ?? []);
      });
    }

    // Remove as questões duplicadas geradas pela paginação inclusiva da API.
    const vistos = new Set();
    return questoes.filter((q) => {
      const id = idQuestao(q);
      if (vistos.has(id)) return false;
      vistos.add(id);
      return true;
    });
  } catch (erro) {
    console.error("Falha ao buscar dados do ENEM:", erro);
    return [];
  }
}

