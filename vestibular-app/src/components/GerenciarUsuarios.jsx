import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { supabase } from "../SUPABASE";

const formatarData = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const inicial = (texto = "") => (texto.trim()[0] || "?").toUpperCase();

export default function GerenciarUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState(null);
  const [meuId, setMeuId] = useState(null);
  const [status, setStatus] = useState({ tipo: "", texto: "" });

  const mostrarStatus = (tipo, texto) => {
    setStatus({ tipo, texto });
    setTimeout(() => setStatus({ tipo: "", texto: "" }), 4000);
  };

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data: userData } = await supabase.auth.getUser();
      if (ativo) setMeuId(userData?.user?.id ?? null);

      const { data, error } = await supabase.rpc("admin_listar_usuarios");
      if (!ativo) return;

      if (error) {
        setErro(
          "Não foi possível carregar os usuários. Você já rodou o supabase_migration.sql (parte 6)?",
        );
        setCarregando(false);
        return;
      }
      setUsuarios(data || []);
      setCarregando(false);
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, []);

  async function trocarCargo(u) {
    const novoCargo = u.cargo === "admin" ? "aluno" : "admin";

    if (u.user_id === meuId && novoCargo !== "admin") {
      mostrarStatus("erro", "Você não pode remover o seu próprio acesso de admin.");
      return;
    }

    const anterior = usuarios;
    // Atualização otimista: reflete na hora e reverte se der erro.
    setUsuarios((prev) =>
      prev.map((x) =>
        x.user_id === u.user_id ? { ...x, cargo: novoCargo } : x,
      ),
    );
    setSalvandoId(u.user_id);

    const { error } = await supabase.rpc("admin_definir_cargo", {
      alvo: u.user_id,
      novo_cargo: novoCargo,
    });

    setSalvandoId(null);

    if (error) {
      setUsuarios(anterior);
      mostrarStatus("erro", error.message || "Falha ao alterar o cargo.");
      return;
    }
    mostrarStatus(
      "sucesso",
      `${u.nome} agora é ${novoCargo === "admin" ? "administrador" : "aluno"}.`,
    );
  }

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.nome || "").toLowerCase().includes(termo) ||
        (u.email || "").toLowerCase().includes(termo),
    );
  }, [usuarios, busca]);

  const totalAdmins = usuarios.filter((u) => u.cargo === "admin").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={19} className="text-gold-400" /> Usuários cadastrados
          </h2>
          <p className="text-sm text-ink-400 mt-0.5">
            {usuarios.length} conta{usuarios.length === 1 ? "" : "s"} ·{" "}
            {totalAdmins} admin{totalAdmins === 1 ? "" : "s"}
          </p>
        </div>

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="bg-ink-950/60 border border-ink-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-ink-600 focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-400/40 transition w-full sm:w-72"
        />
      </div>

      <AnimatePresence>
        {status.texto && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-4 text-sm font-medium px-4 py-2.5 rounded-xl border ${
              status.tipo === "sucesso"
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : "text-rose-400 border-rose-500/30 bg-rose-500/10"
            }`}
          >
            {status.texto}
          </motion.div>
        )}
      </AnimatePresence>

      {carregando ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[68px] rounded-2xl bg-ink-900/50 border border-ink-800 animate-pulse"
            />
          ))}
        </div>
      ) : erro ? (
        <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-300 text-sm">
          {erro}
        </div>
      ) : listaFiltrada.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-ink-800 text-center text-ink-500">
          {busca
            ? "Nenhum usuário corresponde à busca."
            : "Nenhum usuário cadastrado ainda."}
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {listaFiltrada.map((u) => {
              const ehAdmin = u.cargo === "admin";
              const souEu = u.user_id === meuId;
              const salvando = salvandoId === u.user_id;
              return (
                <motion.li
                  key={u.user_id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-ink-900/50 border border-ink-800 hover:border-ink-700 transition"
                >
                  <div
                    className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold ${
                      ehAdmin
                        ? "bg-gold-400 text-ink-950"
                        : "bg-ink-700 text-ink-200"
                    }`}
                  >
                    {inicial(u.nome)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white truncate">
                        {u.nome}
                      </span>
                      {souEu && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 bg-ink-800 px-1.5 py-0.5 rounded">
                          você
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                          ehAdmin
                            ? "bg-gold-400/15 text-gold-300"
                            : "bg-white/[0.06] text-ink-300"
                        }`}
                      >
                        {ehAdmin ? "Admin" : "Aluno"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-500 mt-0.5">
                      <span className="truncate">{u.email}</span>
                      <span className="text-ink-700">·</span>
                      <span className="whitespace-nowrap">
                        {formatarData(u.criado_em)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => trocarCargo(u)}
                    disabled={salvando || (souEu && ehAdmin)}
                    title={
                      souEu && ehAdmin
                        ? "Você não pode remover o seu próprio acesso de admin"
                        : ehAdmin
                          ? "Rebaixar para aluno"
                          : "Promover a admin"
                    }
                    className={`shrink-0 text-sm font-bold py-2 px-4 rounded-xl border transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      ehAdmin
                        ? "border-ink-700 text-ink-300 hover:border-rose-500/50 hover:text-rose-400"
                        : "border-gold-400/40 text-gold-300 hover:bg-gold-400/10"
                    }`}
                  >
                    {salvando
                      ? "..."
                      : ehAdmin
                        ? "Tornar aluno"
                        : "Tornar admin"}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
