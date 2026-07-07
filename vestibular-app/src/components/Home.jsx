import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Target,
  CheckCircle2,
  CalendarDays,
  Trophy,
  GraduationCap,
  Timer,
  Library,
  ArrowRight,
  Clock,
} from "lucide-react";
import { supabase } from "../SUPABASE";
import { processarEstatisticas } from "./estatisticas.js";
import NoticiasDestaque from "./NoticiasDestaque";
import { Cartao, Esqueleto, BarraProgresso } from "./ui";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const dataLonga = () =>
  new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const ATALHOS = [
  {
    aba: "enem",
    icone: GraduationCap,
    titulo: "Resolver questões",
    texto: "Banco oficial do ENEM",
  },
  {
    aba: "simulados",
    icone: Timer,
    titulo: "Fazer um simulado",
    texto: "Contra o relógio",
  },
  {
    aba: "materiais",
    icone: Library,
    titulo: "Abrir a biblioteca",
    texto: "Provas da UERJ",
  },
];

function CartaoIndicador({ icone: Icone, valor, rotulo, detalhe, indice }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indice * 0.06, duration: 0.4, ease: "easeOut" }}
    >
      <Cartao className="p-5 h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="w-9 h-9 rounded-xl bg-gold-400/10 border border-gold-400/20 text-gold-400 flex items-center justify-center">
            <Icone size={17} strokeWidth={2} />
          </span>
        </div>
        <p className="font-display text-2xl font-black text-white tabular-nums leading-none">
          {valor}
        </p>
        <p className="text-xs text-ink-400 font-semibold mt-1.5">{rotulo}</p>
        {detalhe && <p className="text-[11px] text-ink-500 mt-0.5">{detalhe}</p>}
      </Cartao>
    </motion.div>
  );
}

export default function Home({ cronograma, userId, aoNavegar }) {
  const [nome, setNome] = useState("");
  const [stats, setStats] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return;
      const completo = data?.user?.user_metadata?.nome || "";
      setNome(completo.trim().split(" ")[0]);
    });

    processarEstatisticas(userId).then((s) => {
      if (!ativo) return;
      setStats(s);
      setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [userId]);

  const geral = stats?.geral;

  return (
    <div className="max-w-5xl">
      {/* SAUDAÇÃO */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-ink-500 font-semibold capitalize">
          {dataLonga()}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
          {saudacao()}
          {nome ? (
            <>
              , <span className="text-gold-400">{nome}</span>
            </>
          ) : (
            ""
          )}
          .
        </h1>
        <p className="text-ink-400 mt-2">
          Continue de onde parou — cada questão te deixa mais perto da UERJ.
        </p>
      </div>

      {/* INDICADORES */}
      {carregando ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <CartaoIndicador
            indice={0}
            icone={Target}
            valor={`${geral?.taxaAcerto ?? 0}%`}
            rotulo="Taxa de acerto"
            detalhe={geral?.total ? undefined : "Responda questões para começar"}
          />
          <CartaoIndicador
            indice={1}
            icone={CheckCircle2}
            valor={geral?.totalQuestoes ?? 0}
            rotulo="Questões respondidas"
            detalhe={
              geral?.acertos != null
                ? `${geral.acertos} acertos · ${geral.erros} erros`
                : undefined
            }
          />
          <CartaoIndicador
            indice={2}
            icone={CalendarDays}
            valor={geral?.diasAtivos ?? 0}
            rotulo="Dias de estudo"
            detalhe={
              geral?.mediaDia ? `~${geral.mediaDia} questões/dia` : undefined
            }
          />
          <CartaoIndicador
            indice={3}
            icone={Trophy}
            valor={geral?.melhorMateria?.name ?? "—"}
            rotulo="Melhor matéria"
            detalhe={
              geral?.melhorMateria
                ? `${geral.melhorMateria.pct}% de acerto`
                : "Mínimo de 3 questões"
            }
          />
        </div>
      )}

      {/* ATALHOS — próximo passo */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {ATALHOS.map((a, i) => (
          <motion.button
            key={a.aba}
            type="button"
            onClick={() => aoNavegar?.(a.aba)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
            className="group flex items-center gap-3.5 p-4 rounded-2xl bg-ink-900 border border-white/[0.06]
                       text-left transition-all duration-300 hover:border-gold-400/30 hover:-translate-y-0.5
                       hover:shadow-[var(--shadow-card)] active:scale-[0.98]"
          >
            <span className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.04] border border-white/[0.06] text-ink-300 flex items-center justify-center transition-colors duration-300 group-hover:bg-gold-400/10 group-hover:border-gold-400/25 group-hover:text-gold-400">
              <a.icone size={18} strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-white">
                {a.titulo}
              </span>
              <span className="block text-xs text-ink-400 mt-0.5">{a.texto}</span>
            </span>
            <ArrowRight
              size={16}
              className="text-ink-600 transition-all duration-300 group-hover:text-gold-400 group-hover:translate-x-0.5"
            />
          </motion.button>
        ))}
      </div>

      {/* NOTÍCIAS */}
      <NoticiasDestaque />

      {/* PLANO SEMANAL */}
      {cronograma.length > 0 && (
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <Clock size={18} className="text-gold-400" />
            <h2 className="font-display text-xl font-black text-white tracking-tight">
              Seu plano semanal
            </h2>
          </div>
          <p className="text-sm text-ink-400 mb-5 -mt-2">
            Divisão de carga horária ideal para as suas disciplinas.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cronograma.map((materia, i) => {
              const horasNum = Number.parseFloat(materia.horas) || 0;
              const pct = Math.min(100, (horasNum / 15) * 100);
              return (
                <motion.div
                  key={materia.id ?? materia.nome}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.4 }}
                >
                  <Cartao interativo className="p-5 group">
                    <div className="flex justify-between items-center mb-3.5">
                      <span className="font-semibold text-ink-100 group-hover:text-white transition-colors">
                        {materia.nome}
                      </span>
                      <span className="text-xs font-bold bg-gold-400/10 text-gold-300 border border-gold-400/20 px-2.5 py-1 rounded-lg tabular-nums">
                        {materia.horas}h / semana
                      </span>
                    </div>
                    <BarraProgresso valor={pct} />
                  </Cartao>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
