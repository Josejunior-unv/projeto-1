import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../SUPABASE";

export default function TarefasFeitas() {
  const listasDownload = [
    {
      id: 1,
      materia: "Matemática",
      descricao: "Funções, Geometria e base essencial para Cálculo.",
      tag: "Foco UERJ",
      corTexto: "text-blue-400",
      corFundo: "bg-blue-500/10",
      corBorda: "border-blue-500/20",
      corHover: "hover:border-blue-400",
    },
    {
      id: 2,
      materia: "Português",
      descricao: "Interpretação de texto, gramática e literatura.",
      tag: "Linguagens",
      corTexto: "text-yellow-300",
      corFundo: "bg-yellow-500/10",
      corBorda: "border-yellow-500/20",
      corHover: "hover:border-yellow-300",
    },
    {
      id: 3,
      materia: "Física",
      descricao: "Cinemática, Leis de Newton e Eletromagnetismo.",
      tag: "Exatas",
      corTexto: "text-emerald-400",
      corFundo: "bg-emerald-500/10",
      corBorda: "border-emerald-500/20",
      corHover: "hover:border-emerald-400",
    },
    {
      id: 4,
      materia: "Química",
      descricao: "Estequiometria e Química Orgânica passo a passo.",
      tag: "Natureza",
      corTexto: "text-purple-400",
      corFundo: "bg-purple-500/10",
      corBorda: "border-purple-500/20",
      corHover: "hover:border-purple-400",
    },
    {
      id: 5,
      materia: "Biologia",
      descricao: "Citologia, Genética e Ecologia para vestibulares.",
      tag: "Natureza",
      corTexto: "text-green-300",
      corFundo: "bg-green-500/10",
      corBorda: "border-green-500/20",
      corHover: "hover:border-green-300",
    },
    {
      id: 6,
      materia: "História",
      descricao: "História do Brasil e Geral: temas recorrentes do ENEM.",
      tag: "Humanas",
      corTexto: "text-amber-300",
      corFundo: "bg-amber-500/10",
      corBorda: "border-amber-500/20",
      corHover: "hover:border-amber-300",
    },
    {
      id: 7,
      materia: "Geografia",
      descricao: "Geografia física e humana com mapas e atualidades.",
      tag: "Humanas",
      corTexto: "text-cyan-300",
      corFundo: "bg-cyan-500/10",
      corBorda: "border-cyan-500/20",
      corHover: "hover:border-cyan-300",
    },
    {
      id: 8,
      materia: "Inglês",
      descricao: "Leitura e vocabulário: compreensão de textos em inglês.",
      tag: "Língua Estrangeira",
      corTexto: "text-sky-300",
      corFundo: "bg-sky-500/10",
      corBorda: "border-sky-500/20",
      corHover: "hover:border-sky-300",
    },
    {
      id: 9,
      materia: "Redação",
      descricao: "Coletânea de temas, estrutura e modelos de redação.",
      tag: "Prática",
      corTexto: "text-rose-400",
      corFundo: "bg-rose-500/10",
      corBorda: "border-rose-500/20",
      corHover: "hover:border-rose-400",
    },
    {
      id: 10,
      materia: "Filosofia",
      descricao: "Conceitos e autores essenciais para questões de humanas.",
      tag: "Humanas",
      corTexto: "text-indigo-300",
      corFundo: "bg-indigo-500/10",
      corBorda: "border-indigo-500/20",
      corHover: "hover:border-indigo-300",
    },
  ];

  const [selecionada, setSelecionada] = useState(null);
  const [arquivos, setArquivos] = useState([]);
  const [loadingArquivos, setLoadingArquivos] = useState(false);

  useEffect(() => {
    if (!selecionada) return;

    async function buscar() {
      setLoadingArquivos(true);

      const { data, error } = await supabase
        .from("materiais_estudo")
        .select("*")
        .eq("materia", selecionada.materia)
        .order("criado_em", { ascending: false });

      if (!error) setArquivos(data);
      setLoadingArquivos(false);
    }

    buscar();
  }, [selecionada]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto p-8"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white tracking-tight mb-2">
          Listas de Exercícios
        </h2>
        <p className="text-slate-400">
          Clique em uma matéria para ver os materiais já cadastrados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {listasDownload.map((item, index) => (
          <motion.button
            key={item.id}
            onClick={() => setSelecionada(item)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`group relative flex flex-col p-6 rounded-3xl bg-slate-900/50 backdrop-blur-sm border ${item.corBorda} ${item.corHover} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl text-left`}
          >
            <div className="flex justify-between items-start mb-4">
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold ${item.corTexto} ${item.corFundo}`}
              >
                {item.tag}
              </div>
              <div className="text-slate-500 group-hover:text-white transition-colors">
                📄
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              {item.materia}
            </h3>
            <p className="text-sm text-slate-400 flex-1">{item.descricao}</p>

            <div className="mt-6 text-sm font-semibold text-slate-300 flex items-center gap-2 group-hover:text-white transition-colors">
              <span>Ver materiais</span>
              <span className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selecionada && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-gray-900 p-6 rounded-2xl w-full max-w-2xl border border-gray-700"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">
                  {selecionada.materia}
                </h2>
                <button
                  onClick={() => setSelecionada(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {loadingArquivos ? (
                <p className="text-slate-400">Carregando...</p>
              ) : arquivos.length === 0 ? (
                <p className="text-slate-400">Nenhum material encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {arquivos.map((a) => (
                    <a
                      key={a.id}
                      href={a.url_arquivo}
                      target="_blank"
                      className="block p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500"
                    >
                      <p className="text-white font-semibold">{a.titulo}</p>
                      <p className="text-slate-400 text-sm">{a.descricao}</p>
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
