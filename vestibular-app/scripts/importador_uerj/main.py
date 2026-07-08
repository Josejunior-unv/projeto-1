"""Importador de provas da UERJ — orquestrador.

Etapas: crawl -> download -> extração -> classificação -> publicação.

Uso típico (na pasta scripts/importador_uerj):
    pip install -r requirements.txt
    set SUPABASE_SERVICE_ROLE_KEY=...   (PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY="...")
    python main.py                      # pipeline completo
    python main.py --sem-publicar       # só gera os JSONs locais (teste)
    python main.py --sem-crawl          # reusa o catálogo da última execução
    python main.py --ano 2024 --limite 5
"""

import argparse
import logging
import sys
from pathlib import Path

# Usa o repositório de certificados do SISTEMA para validar TLS — o site da
# UERJ não envia a cadeia completa e o bundle padrão do Python (certifi)
# rejeita a conexão. O truststore resolve sem desligar a verificação.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:  # segue com o certifi; pode falhar no site da UERJ
    logging.getLogger("main").warning(
        "truststore não instalado — se houver erro de certificado, "
        "rode: pip install truststore"
    )

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import ARQ_LOG, DIR_IMAGENS, garantir_diretorios  # noqa: E402
from crawler import carregar_catalogo, rastrear  # noqa: E402
from baixar import baixar_catalogo  # noqa: E402
from extrair import extrair_gabarito, extrair_questoes, salvar_extracao  # noqa: E402
from classificar import chave_prova, classificar  # noqa: E402

TIPOS_PROVA = {"qualificacao", "discursivo"}
TIPOS_RESPOSTA = {"gabarito", "padrao_resposta"}
ROTULO_FASE = {
    "1EQ": "1º Exame de Qualificação",
    "2EQ": "2º Exame de Qualificação",
    "ED": "Exame Discursivo",
}


def titulo_da_prova(p):
    """Título legível: 'UERJ 2026 · Exame Discursivo · Física'."""
    partes = [f"UERJ {p.get('ano')}" if p.get("ano") else "UERJ"]
    partes.append(ROTULO_FASE.get(p.get("fase"), p.get("tipo") or "Prova"))
    if p.get("disciplina"):
        partes.append(p["disciplina"])
    if p.get("tipo") == "gabarito":
        partes.append("Gabarito")
    elif p.get("tipo") == "padrao_resposta":
        partes.append("Padrão de respostas")
    return " · ".join(partes)


def configurar_logs(verbose):
    garantir_diretorios()
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(ARQ_LOG, encoding="utf-8"),
        ],
    )


def main():
    parser = argparse.ArgumentParser(description="Importa as provas públicas da UERJ.")
    parser.add_argument("--sem-crawl", action="store_true",
                        help="reusa o catálogo salvo em vez de rastrear o site")
    parser.add_argument("--sem-publicar", action="store_true",
                        help="não envia nada ao Supabase (gera apenas JSON local)")
    parser.add_argument("--ano", type=int, default=None, help="processa só um ano")
    parser.add_argument("--limite", type=int, default=None,
                        help="máximo de PDFs de prova a processar")
    parser.add_argument("--max-paginas", type=int, default=None,
                        help="limite de páginas HTML do crawl (testes)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    configurar_logs(args.verbose)
    log = logging.getLogger("main")

    # 1) CRAWL ---------------------------------------------------------
    if args.sem_crawl:
        catalogo = carregar_catalogo()
        if not catalogo:
            log.error("Catálogo vazio — rode sem --sem-crawl primeiro.")
            return 1
        # Reaplica as regras de classificação mais recentes ao cache.
        from crawler import classificar_item

        for c in catalogo:
            ano, tipo, fase, disciplina = classificar_item(
                c.get("texto", ""), c["url"]
            )
            c.update({"ano": ano, "tipo": tipo, "fase": fase, "disciplina": disciplina})
        log.info("Catálogo em cache: %d PDFs (reclassificados).", len(catalogo))
    else:
        log.info("Rastreando %s ...", "vestibular.uerj.br")
        if args.max_paginas:
            catalogo = rastrear(max_paginas=args.max_paginas)
        else:
            catalogo = rastrear()

    if args.ano:
        catalogo = [c for c in catalogo if c.get("ano") == args.ano]
        log.info("Filtro --ano %d: %d PDFs.", args.ano, len(catalogo))

    # Só baixamos o que alimenta o banco: provas, gabaritos e padrões.
    # Editais/manuais/comunicados ("outro") ficam fora.
    total_bruto = len(catalogo)
    catalogo = [c for c in catalogo if c.get("tipo") in TIPOS_PROVA | TIPOS_RESPOSTA]
    log.info(
        "%d PDFs relevantes (%d administrativos ignorados).",
        len(catalogo), total_bruto - len(catalogo),
    )

    # 2) DOWNLOAD ------------------------------------------------------
    with tqdm(total=len(catalogo), desc="Baixando PDFs", unit="pdf") as barra:
        manifesto = baixar_catalogo(catalogo, progresso=barra)

    if args.ano:
        manifesto = [m for m in manifesto if m.get("ano") == args.ano]

    provas = [m for m in manifesto if m.get("tipo") in TIPOS_PROVA]
    gabaritos = [m for m in manifesto if m.get("tipo") in TIPOS_RESPOSTA]
    if args.limite:
        provas = provas[: args.limite]
    log.info("%d PDFs de prova, %d de gabarito/padrão.", len(provas), len(gabaritos))

    # 3) GABARITOS (respostas por edição) -------------------------------
    # Só PDFs de gabarito valem como fonte de respostas: os padrões de
    # resposta são dissertativos e produziriam casamentos falsos.
    respostas_por_edicao = {}
    for g in tqdm(gabaritos, desc="Lendo gabaritos", unit="pdf"):
        if g.get("tipo") != "gabarito":
            continue
        mapa = extrair_gabarito(g)
        if mapa:
            respostas_por_edicao.setdefault(chave_prova(g), {}).update(mapa)

    # 4) EXTRAÇÃO + CLASSIFICAÇÃO ---------------------------------------
    resultado = []
    for prova in tqdm(provas, desc="Extraindo questões", unit="prova"):
        prefixo = f"{prova.get('ano') or 'x'}_{prova.get('fase') or 'geral'}_{prova['hash'][:8]}"
        try:
            questoes = extrair_questoes(prova, prefixo)
        except Exception as erro:
            log.error("Extração falhou em %s: %s", prova["url"], erro)
            continue

        respostas = respostas_por_edicao.get(chave_prova(prova), {})
        for q in questoes:
            q.update(classificar(q, disciplina_sugerida=prova.get("disciplina")))
            if q["numero"] in respostas and q.get("alternativas"):
                q["resposta"] = respostas[q["numero"]]

        resultado.append({"prova": prova, "questoes": questoes})

    # Gabaritos e padrões de resposta também entram no acervo (sem questões):
    # aparecem na Biblioteca UERJ para consulta dos alunos.
    for g in gabaritos:
        resultado.append({"prova": g, "questoes": []})

    salvar_extracao(resultado)
    total_q = sum(len(r["questoes"]) for r in resultado)
    log.info("Extração total: %d provas, %d questões.", len(resultado), total_q)

    if args.sem_publicar:
        log.info("--sem-publicar: fim (JSONs em dados/cache).")
        return 0

    # 5) PUBLICAÇÃO ------------------------------------------------------
    from publicar import Publicador  # importa só quando vai usar credenciais

    pub = Publicador()
    pub.registrar_log("info", "importacao_iniciada",
                      {"provas": len(resultado), "questoes": total_q})

    publicadas = 0
    for r in tqdm(resultado, desc="Publicando", unit="prova"):
        p, questoes = r["prova"], r["questoes"]
        try:
            destino = f"{p.get('ano') or 'sem-ano'}/{Path(p['caminho_local']).name}"
            url_pdf = pub.enviar_arquivo(p["caminho_local"], destino)

            linha = pub.upsert_prova({
                "ano": p.get("ano") or 0,
                "tipo": p.get("tipo"),
                "fase": p.get("fase"),
                "disciplina": p.get("disciplina"),
                "titulo": titulo_da_prova(p),
                "url_original": p["url"],
                "pdf_url": url_pdf,
                "storage_path": f"uerj/{destino}",
                "hash_sha256": p["hash"],
                "paginas": p.get("paginas"),
                "status": "processada" if questoes else "importada",
            })

            linhas_q = []
            for q in questoes:
                urls_imagens = []
                for img in q["imagens"][:6]:  # limite defensivo por questão
                    nome = Path(img).name
                    urls_imagens.append(
                        pub.enviar_arquivo(img, f"imagens/{nome}")
                    )
                linhas_q.append({
                    "prova_id": linha["id"],
                    "numero": q["numero"],
                    "enunciado": q["enunciado"][:8000],
                    "alternativas": q["alternativas"],
                    "resposta": q.get("resposta"),
                    "disciplina": q["disciplina"],
                    "assunto": q["assunto"],
                    "subassunto": q["subassunto"],
                    "dificuldade": q["dificuldade"],
                    "habilidades": q["habilidades"],
                    "imagens": urls_imagens,
                    "pagina": q["pagina"],
                    "url_original": q["url_original"],
                    "classificada": q["classificada"],
                })
            publicadas += pub.upsert_questoes(linhas_q)
        except Exception as erro:
            log.error("Publicação falhou (%s): %s", p["url"], erro)
            pub.registrar_log("erro", "publicacao_falhou",
                              {"url": p["url"], "erro": str(erro)[:400]})

    pub.registrar_log("info", "importacao_concluida",
                      {"provas": len(resultado), "questoes_publicadas": publicadas})
    log.info("Publicação concluída: %d questões no banco.", publicadas)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
