// Áreas do conhecimento do vestibular da UERJ e suas disciplinas.
// Usadas nos filtros combináveis (Banco de Questões, Simulado e
// Biblioteca): filtrar por área = filtrar pelo conjunto de disciplinas.

export const AREAS_CONHECIMENTO = [
  {
    id: "linguagens",
    nome: "Linguagens",
    disciplinas: ["Português", "Inglês", "Espanhol", "Francês", "Redação"],
  },
  {
    id: "matematica",
    nome: "Matemática",
    disciplinas: ["Matemática"],
  },
  {
    id: "natureza",
    nome: "Ciências da Natureza",
    disciplinas: ["Biologia", "Física", "Química"],
  },
  {
    id: "humanas",
    nome: "Ciências Humanas",
    disciplinas: ["História", "Geografia", "Filosofia", "Sociologia"],
  },
];

export const areaPorId = (id) =>
  AREAS_CONHECIMENTO.find((a) => a.id === id) || null;

export const areaDaDisciplina = (disciplina) =>
  AREAS_CONHECIMENTO.find((a) => a.disciplinas.includes(disciplina)) || null;
