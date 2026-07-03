// Fonte única das matérias usadas na área do professor e nas tarefas do aluno.
// Centralizado aqui para evitar listas duplicadas espalhadas pelos componentes.

export const MATERIAS = [
  { nome: "Matemática", icone: "🔢", cor: "blue" },
  { nome: "Português", icone: "📖", cor: "yellow" },
  { nome: "Biologia", icone: "🧬", cor: "green" },
  { nome: "Química", icone: "⚗️", cor: "purple" },
  { nome: "Física", icone: "⚛️", cor: "cyan" },
  { nome: "História", icone: "🏛️", cor: "amber" },
  { nome: "Geografia", icone: "🌍", cor: "emerald" },
  { nome: "Filosofia", icone: "🦉", cor: "indigo" },
  { nome: "Sociologia", icone: "👥", cor: "rose" },
  { nome: "Inglês", icone: "🇬🇧", cor: "sky" },
  { nome: "Espanhol", icone: "🇪🇸", cor: "orange" },
];

// Tipos de conteúdo que o professor pode publicar.
export const TIPOS_MATERIAL = [
  { id: "pdf", label: "PDF", icone: "📄" },
  { id: "link", label: "Link", icone: "🔗" },
  { id: "video", label: "Vídeo", icone: "🎬" },
  { id: "exercicio", label: "Exercício", icone: "✏️" },
  { id: "tarefa", label: "Tarefa", icone: "📌" },
  { id: "aviso", label: "Aviso", icone: "📢" },
  { id: "complementar", label: "Complementar", icone: "📎" },
];

// Tipos que enviam arquivo (upload) em vez de colar URL.
export const TIPOS_UPLOAD = ["pdf"];
// Tipos que usam uma URL colada (link externo).
export const TIPOS_URL = ["link", "video"];

// Mapa de classes Tailwind por cor (definidas estaticamente para o Tailwind
// conseguir detectá-las na build — nada de nomes de classe montados em runtime).
export const CORES_MATERIA = {
  blue: {
    texto: "text-blue-400",
    fundo: "bg-blue-500/10",
    borda: "border-blue-500/20",
    hover: "hover:border-blue-400/60",
    anel: "ring-blue-500",
  },
  yellow: {
    texto: "text-yellow-300",
    fundo: "bg-yellow-500/10",
    borda: "border-yellow-500/20",
    hover: "hover:border-yellow-300/60",
    anel: "ring-yellow-400",
  },
  green: {
    texto: "text-green-300",
    fundo: "bg-green-500/10",
    borda: "border-green-500/20",
    hover: "hover:border-green-300/60",
    anel: "ring-green-500",
  },
  purple: {
    texto: "text-purple-400",
    fundo: "bg-purple-500/10",
    borda: "border-purple-500/20",
    hover: "hover:border-purple-400/60",
    anel: "ring-purple-500",
  },
  cyan: {
    texto: "text-cyan-300",
    fundo: "bg-cyan-500/10",
    borda: "border-cyan-500/20",
    hover: "hover:border-cyan-300/60",
    anel: "ring-cyan-500",
  },
  amber: {
    texto: "text-amber-300",
    fundo: "bg-amber-500/10",
    borda: "border-amber-500/20",
    hover: "hover:border-amber-300/60",
    anel: "ring-amber-500",
  },
  emerald: {
    texto: "text-emerald-400",
    fundo: "bg-emerald-500/10",
    borda: "border-emerald-500/20",
    hover: "hover:border-emerald-400/60",
    anel: "ring-emerald-500",
  },
  indigo: {
    texto: "text-indigo-300",
    fundo: "bg-indigo-500/10",
    borda: "border-indigo-500/20",
    hover: "hover:border-indigo-300/60",
    anel: "ring-indigo-500",
  },
  rose: {
    texto: "text-rose-400",
    fundo: "bg-rose-500/10",
    borda: "border-rose-500/20",
    hover: "hover:border-rose-400/60",
    anel: "ring-rose-500",
  },
  sky: {
    texto: "text-sky-300",
    fundo: "bg-sky-500/10",
    borda: "border-sky-500/20",
    hover: "hover:border-sky-300/60",
    anel: "ring-sky-500",
  },
  orange: {
    texto: "text-orange-300",
    fundo: "bg-orange-500/10",
    borda: "border-orange-500/20",
    hover: "hover:border-orange-300/60",
    anel: "ring-orange-500",
  },
};

export const coresDe = (cor) => CORES_MATERIA[cor] || CORES_MATERIA.blue;

// Prioridades das notícias do mural do administrador.
export const PRIORIDADES = [
  { valor: 0, label: "Normal", icone: "•", classe: "text-slate-400 bg-slate-500/10" },
  { valor: 1, label: "Alta", icone: "▲", classe: "text-amber-400 bg-amber-500/10" },
  { valor: 2, label: "Urgente", icone: "🔥", classe: "text-rose-400 bg-rose-500/10" },
];
export const prioridadeDe = (v) =>
  PRIORIDADES.find((p) => p.valor === Number(v)) || PRIORIDADES[0];
