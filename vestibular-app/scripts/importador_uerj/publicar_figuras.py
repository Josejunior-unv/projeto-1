"""Publicação CIRÚRGICA das figuras — sem reimport destrutivo.

Sobe as figuras renderizadas (gráficos/tabelas/mapas vetoriais que o
`_exportar_imagens` não pegava) e atualiza só a coluna `imagens` das questões
já existentes, casando extração→produção por (hash da prova, número, idioma).

Por que cirúrgico em vez de `python main.py`:
  - PRESERVA os IDs das questões → mantém a Part 12 (classificação manual), a
    Part 13 (gabaritos) e o progresso local do banco UERJ (`questoes_respondidas`).
  - É ADITIVO: `imagens` da extração já inclui o raster antigo como fallback,
    então nenhuma questão perde imagem; +192 ganham figura.

Uso:
    python publicar_figuras.py                 # DRY-RUN (só lê, não escreve)
    SUPABASE_SERVICE_ROLE_KEY=... python publicar_figuras.py --publicar

Requer que `dados/cache/questoes_extraidas.json` tenha sido gerado por
`python main.py --sem-crawl --sem-publicar` com o extrator novo.
"""

import argparse
import json
import logging
import sys
from collections import defaultdict
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import ARQ_EXTRACAO, SUPABASE_ANON_KEY, SUPABASE_URL, TIMEOUT_HTTP  # noqa: E402

log = logging.getLogger("publicar_figuras")
IDIOMAS = {"Inglês", "Espanhol", "Francês"}


def _ler_producao():
    """(questoes, provas) da produção via PostgREST com a anon key (leitura
    pública). Pagina para não bater no teto de 1000 linhas do PostgREST."""
    apikey = SUPABASE_ANON_KEY or "sb_publishable__GrVY6C5aG9TnTXbUqd4xQ_e2aIoLrq"
    base = SUPABASE_URL.rstrip("/")
    h = {"apikey": apikey, "Authorization": f"Bearer {apikey}"}

    def coletar(tabela, select):
        linhas, off = [], 0
        while True:
            r = requests.get(
                f"{base}/rest/v1/{tabela}?select={select}&order=id"
                f"&limit=1000&offset={off}",
                headers=h, timeout=TIMEOUT_HTTP,
            )
            r.raise_for_status()
            lote = r.json()
            linhas += lote
            if len(lote) < 1000:
                return linhas
            off += 1000

    q = coletar("questoes_uerj", "id,prova_id,numero,disciplina,imagens")
    p = coletar("provas_uerj", "id,hash_sha256")
    return q, p


def _mapear(extraidas, prod_q, prod_p):
    """Casa cada questão extraída (com figuras) a um id de produção.

    Chave: hash da prova -> prova_id; depois número (+ disciplina de idioma
    quando o número se repete). Devolve {id_producao: [caminhos_locais]}.
    """
    prova_por_hash = {p["hash_sha256"]: p["id"] for p in prod_p}
    # índice das questões de produção por (prova_id, numero) -> lista
    prod_idx = defaultdict(list)
    for q in prod_q:
        prod_idx[(q["prova_id"], q["numero"])].append(q)

    plano = {}          # id_prod -> caminhos locais das figuras
    sem_match = 0
    for r in extraidas:
        pid = prova_por_hash.get(r["prova"].get("hash_sha256")
                                 or r["prova"].get("hash"))
        if pid is None:
            continue
        for q in r["questoes"]:
            cands = prod_idx.get((pid, q["numero"]))
            if not cands:
                sem_match += 1
                continue
            if len(cands) == 1:
                alvo = cands[0]
            else:
                # número repetido (idiomas 23-27): desempata pela disciplina
                alvo = next(
                    (c for c in cands if c["disciplina"] == q["disciplina"]),
                    None,
                )
                if alvo is None:
                    sem_match += 1
                    continue
            plano[alvo["id"]] = q.get("imagens") or []
    return plano, sem_match


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--publicar", action="store_true",
                    help="escreve na produção (precisa da service key); "
                         "sem isso é dry-run")
    args = ap.parse_args()

    if not Path(ARQ_EXTRACAO).exists():
        raise SystemExit(
            "questoes_extraidas.json não existe — rode antes:\n"
            "  python main.py --sem-crawl --sem-publicar"
        )
    extraidas = json.loads(Path(ARQ_EXTRACAO).read_text(encoding="utf-8"))
    prod_q, prod_p = _ler_producao()
    plano, sem_match = _mapear(extraidas, prod_q, prod_p)

    prod_por_id = {q["id"]: q for q in prod_q}
    ganham = sum(
        1 for qid, imgs in plano.items()
        if imgs and not (prod_por_id[qid].get("imagens"))
    )
    perdem = sum(
        1 for qid, imgs in plano.items()
        if not imgs and prod_por_id[qid].get("imagens")
    )
    total_pngs = sum(len(v) for v in plano.values())

    print("=== PLANO DE PUBLICAÇÃO DE FIGURAS (cirúrgico) ===")
    print(f"  questões extraídas casadas: {len(plano)}")
    print(f"  sem match na produção:      {sem_match}")
    print(f"  questões que GANHAM figura: {ganham}")
    print(f"  questões que PERDERIAM img: {perdem}  (deve ser ~0)")
    print(f"  PNGs a subir no Storage:    {total_pngs}")

    if not args.publicar:
        print("\nDRY-RUN — nada foi escrito. Rode com --publicar + service key.")
        return 0

    if perdem > 0:
        raise SystemExit(
            f"ABORTADO: {perdem} questões perderiam imagem — investigar antes."
        )

    from publicar import Publicador
    pub = Publicador()
    atualizadas = 0
    for qid, caminhos in plano.items():
        urls = []
        for c in caminhos[:6]:
            nome = Path(c).name
            urls.append(pub.enviar_arquivo(c, f"imagens/{nome}"))
        r = pub.sessao.patch(
            f"{pub.base}/rest/v1/questoes_uerj?id=eq.{int(qid)}",
            json={"imagens": urls},
            headers={"Content-Type": "application/json", "Prefer": "return=minimal"},
            timeout=TIMEOUT_HTTP * 2,
        )
        if r.status_code >= 300:
            log.error("PATCH q%s falhou %s: %s", qid, r.status_code, r.text[:200])
            continue
        atualizadas += 1
    pub.registrar_log("info", "figuras_publicadas", {"questoes": atualizadas})
    print(f"\nPublicado: {atualizadas} questões atualizadas com figuras.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
