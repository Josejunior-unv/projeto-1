import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cx } from "../ui/cx";

// Aviso fixo exibido no topo das telas de Questões da UERJ. As questões vêm de
// um pipeline de importação automática (scripts/importador_uerj) e ainda podem
// ter falhas de extração/classificação/gabarito — este banner deixa isso
// transparente para o aluno ANTES de ele responder, e aponta a denúncia.
export default function AvisoUerj({ className = "" }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx(
        "flex items-start gap-3 px-4 py-3 rounded-2xl mb-5",
        "bg-amber-500/10 border border-amber-500/30 text-amber-200",
        className,
      )}
    >
      <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
      <p className="text-[13px] leading-relaxed">
        As questões da UERJ são importadas automaticamente e{" "}
        <span className="font-semibold text-amber-100">
          ainda podem conter erros
        </span>{" "}
        de extração, classificação ou gabarito. O <strong>José</strong> está
        trabalhando para corrigi-las. Se encontrar algo errado, use o botão de{" "}
        <span className="font-semibold text-amber-100">denúncia</span> na questão
        — isso ajuda muito.
      </p>
    </motion.div>
  );
}
