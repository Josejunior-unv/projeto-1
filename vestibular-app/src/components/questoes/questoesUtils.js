// Utilitários compartilhados das questões do ENEM.
// Centralizados aqui para que a tela de Questões e a de Simulado usem exatamente
// a mesma lógica (áreas, dificuldade estimada, nome amigável da matéria) sem
// duplicação. `idQuestao` continua morando no enemService (camada de dados).

import { idQuestao } from "../enemService.js";

export { idQuestao };

// Filtros por área do conhecimento. A API do ENEM classifica cada questão em
// uma das 4 grandes áreas (`discipline`) + língua estrangeira (`language`).
export const FILTROS = [
  { id: "todas", label: "Todas", icone: "🎯", testar: () => true },
  {
    id: "matematica",
    label: "Matemática",
    icone: "🔢",
    testar: (q) => q.discipline === "matematica",
  },
  {
    id: "linguagens",
    label: "Linguagens",
    icone: "📖",
    testar: (q) => q.discipline === "linguagens",
  },
  {
    id: "humanas",
    label: "Ciências Humanas",
    icone: "🌍",
    testar: (q) => q.discipline === "ciencias-humanas",
  },
  {
    id: "natureza",
    label: "Ciências da Natureza",
    icone: "🔬",
    testar: (q) => q.discipline === "ciencias-natureza",
  },
  {
    id: "ingles",
    label: "Inglês",
    icone: "🇬🇧",
    testar: (q) => q.language === "ingles",
  },
  {
    id: "espanhol",
    label: "Espanhol",
    icone: "🇪🇸",
    testar: (q) => q.language === "espanhol",
  },
];

// Dificuldade ESTIMADA (a API não informa dificuldade). Heurística baseada no
// tamanho do enunciado + alternativas + presença de imagens. É aproximada.
export const DIFICULDADES = {
  facil: { label: "Fácil", icone: "🟢", cor: "text-emerald-400" },
  media: { label: "Média", icone: "🟡", cor: "text-amber-400" },
  dificil: { label: "Difícil", icone: "🔴", cor: "text-rose-400" },
};

export const FILTROS_DIFICULDADE = [
  { id: "todas", label: "Todas", icone: "⚖️" },
  { id: "facil", label: "Fácil", icone: "🟢" },
  { id: "media", label: "Média", icone: "🟡" },
  { id: "dificil", label: "Difícil", icone: "🔴" },
];

export function estimarDificuldade(q) {
  const ctx = (q.context || "").length;
  const alts = q.alternatives || [];
  const altLen = alts.reduce((s, a) => s + (a.text || "").length, 0);
  const temImagem = (q.files || []).length > 0 || alts.some((a) => a.file);
  const score = ctx + altLen + (temImagem ? 250 : 0);
  if (score < 750) return "facil";
  if (score < 1100) return "media";
  return "dificil";
}

// Nome amigável da matéria, usado no selo da questão e ao salvar estatísticas.
export function nomeMateria(questao) {
  if (questao.language === "ingles") return "Inglês";
  if (questao.language === "espanhol") return "Espanhol";

  const mapa = {
    matematica: "Matemática",
    linguagens: "Linguagens",
    "ciencias-humanas": "Ciências Humanas",
    "ciencias-natureza": "Ciências da Natureza",
  };

  return mapa[questao.discipline] || "ENEM";
}

// Mapa id-da-questão -> dificuldade estimada, calculado uma vez por lote.
export function mapaDificuldade(questoes) {
  const mapa = {};
  questoes.forEach((q) => {
    mapa[idQuestao(q)] = estimarDificuldade(q);
  });
  return mapa;
}
