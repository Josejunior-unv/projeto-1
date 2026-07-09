import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Download,
  Eye,
  ClipboardCheck,
  FileText,
  Loader2,
} from "lucide-react";
import {
  listarProvasComQuestoes,
  acharAnexo,
  questoesDaProva,
} from "./uerjEstudoService";
import ExecutorQuestoes from "./ExecutorQuestoes";
import { Botao, Selo, EstadoVazio, Esqueleto, Alerta } from "../ui";

// Área "Provas Completas": cada edição da UERJ com Resolver Online,
// Baixar PDF, Gabarito e Padrão de Resposta.

export default function ProvasUerj({ userId, onVoltar }) {
  const [provas, setProvas] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(null); // {titulo, questoes}
  const [abrindoId, setAbrindoId] = useState(null);
  const [aviso, setAviso] = useState(null); // feedback quando não há questões respondíveis

  // Some com o aviso sozinho depois de alguns segundos.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    let ativo = true;
    listarProvasComQuestoes().then(({ provas: p, anexos: a }) => {
      if (!ativo) return;
      setProvas(p);
      setAnexos(a);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function resolverOnline(prova) {
    setAbrindoId(prova.id);
    const { data } = await questoesDaProva(prova.id);
    setAbrindoId(null);
    const respondiveis = data.filter((q) => (q.alternativas || []).length > 0);
    if (respondiveis.length > 0) {
      setAviso(null);
      setExecutando({ titulo: prova.titulo, questoes: respondiveis });
    } else {
      setAviso(
        `"${prova.titulo}" ainda não tem questões prontas para resolver online. ` +
          "Use o PDF e o gabarito abaixo enquanto a equipe finaliza a importação.",
      );
    }
  }

  if (executando) {
    return (
      <ExecutorQuestoes
        questoes={executando.questoes}
        titulo={executando.titulo}
        tipo="prova"
        userId={userId}
        onSair={() => setExecutando(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      {onVoltar && (
        <button
          onClick={onVoltar}
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-semibold mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
      )}

      {aviso && (
        <Alerta variante="aviso" className="mb-4">
          {aviso}
        </Alerta>
      )}

      {carregando ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} className="h-32" />
          ))}
        </div>
      ) : provas.length === 0 ? (
        <EstadoVazio
          icone={FileText}
          titulo="Nenhuma prova importada ainda"
          descricao="As provas da UERJ aparecem aqui assim que forem importadas pela equipe."
        />
      ) : (
        <div className="space-y-4">
          {provas.map((p, i) => {
            const gabarito = acharAnexo(anexos, p, "gabarito");
            const padrao = acharAnexo(anexos, p, "padrao_resposta");
            const resolvivel = p.comGabarito > 0;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
                className="p-5 rounded-2xl bg-ink-900 border border-white/[0.08] shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white leading-snug">
                      {p.titulo}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Selo variante="ouro">
                        {p.tipo === "discursivo" ? "Discursiva" : "Objetiva"}
                      </Selo>
                      {p.questoes > 0 && (
                        <Selo>
                          {p.questoes} {p.questoes === 1 ? "questão" : "questões"}
                        </Selo>
                      )}
                      {p.comGabarito > 0 && (
                        <Selo variante="sucesso">
                          {p.comGabarito} com gabarito
                        </Selo>
                      )}
                      {p.disciplinas.slice(0, 3).map((d) => (
                        <Selo key={d}>{d}</Selo>
                      ))}
                    </div>
                  </div>
                  {p.ano > 0 && (
                    <span className="font-display text-2xl font-black text-ink-500 tabular-nums">
                      {p.ano}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-white/[0.05]">
                  {resolvivel && (
                    <Botao
                      tamanho="sm"
                      onClick={() => resolverOnline(p)}
                      disabled={abrindoId === p.id}
                    >
                      {abrindoId === p.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      Resolver online
                    </Botao>
                  )}
                  {p.pdf_url && (
                    <>
                      <Botao
                        as="a"
                        href={p.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variante="secundario"
                        tamanho="sm"
                      >
                        <Eye size={14} /> Abrir PDF
                      </Botao>
                      <Botao
                        as="a"
                        href={p.pdf_url}
                        download
                        variante="fantasma"
                        tamanho="sm"
                      >
                        <Download size={14} /> Baixar
                      </Botao>
                    </>
                  )}
                  {gabarito?.pdf_url && (
                    <Botao
                      as="a"
                      href={gabarito.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variante="fantasma"
                      tamanho="sm"
                    >
                      <ClipboardCheck size={14} /> Gabarito
                    </Botao>
                  )}
                  {padrao?.pdf_url && (
                    <Botao
                      as="a"
                      href={padrao.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variante="fantasma"
                      tamanho="sm"
                    >
                      <ClipboardCheck size={14} /> Padrão de resposta
                    </Botao>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
