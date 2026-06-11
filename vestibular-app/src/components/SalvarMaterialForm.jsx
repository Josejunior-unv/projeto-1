import { useState } from "react";
import { supabase } from "../SUPABASE";

export default function SalvarMaterialForm({ materiaDefault, onSaved }) {
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSalvar() {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const usuario_id = userData?.user?.id;

      const { data, error } = await supabase
        .from("materiais_estudo")
        .insert([
          {
            usuario_id,
            materia: materiaDefault,
            titulo,
            url_arquivo: url,
            descricao,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      onSaved(data);

      setTitulo("");
      setUrl("");
      setDescricao("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 bg-gray-800/40 rounded-xl border border-gray-700">
      <h3 className="text-white font-bold mb-3">Adicionar novo material</h3>

      <input
        className="w-full mb-2 p-2 rounded bg-gray-900 border border-gray-700 text-white"
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />

      <input
        className="w-full mb-2 p-2 rounded bg-gray-900 border border-gray-700 text-white"
        placeholder="URL do arquivo"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <textarea
        className="w-full mb-2 p-2 rounded bg-gray-900 border border-gray-700 text-white"
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <button
        onClick={handleSalvar}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
      >
        {loading ? "Salvando..." : "Salvar material"}
      </button>
    </div>
  );
}
