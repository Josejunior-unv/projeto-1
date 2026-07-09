"""Gera a PARTE 13 do supabase_migration.sql — recupera gabaritos de objetivas.

CONTEXTO. Produção tem ~120 objetivas não-idioma sem `resposta`. A causa é o
guarda da linha ~168 do `main.py`: um gabarito cujo NOME não traz ano/fase e
cujo conteúdo não imprime "Vestibular Estadual" (os gabaritos-tabela antigos,
ex. `uploads/2019/06/Gabarito.pdf` do 1º EQ 2020) é descartado como "outro
certame" ANTES de alimentar o fallback por pasta — então a prova da mesma pasta
fica sem gabarito. A correção definitiva é no pipeline + reimport (troca IDs,
perde a Part 12); este script faz a recuperação CIRÚRGICA por SQL, sem reimport.

MÉTODO. Reproduz o casamento gabarito→prova do `main.py` (edição + pasta),
porém SEM o descarte prematuro (registra o mapa por pasta mesmo dos gabaritos
"anônimos"). Depois:
  1. VALIDA contra produção: para toda objetiva não-idioma que JÁ tem `resposta`,
     a letra recuperada tem de ser idêntica. Qualquer divergência ABORTA (sinal
     de casamento errado) — nada é emitido às cegas.
  2. Emite `update ... set resposta='X' where id=N and resposta is null` só para
     as objetivas não-idioma hoje sem gabarito, e só de provas cuja validação
     ficou 100%% limpa.

Regras de ouro preservadas: idioma NUNCA recebe gabarito; números repetidos
(23–27 com várias versões de idioma) são pulados; só letras A–D.

Uso:
    python gerar_part13.py            # imprime o bloco SQL (stderr traz o resumo)
    python gerar_part13.py --stat     # só o resumo + validação
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import SUPABASE_ANON_KEY, SUPABASE_URL, TIMEOUT_HTTP  # noqa: E402
from extrair import extrair_gabarito  # noqa: E402

IDIOMAS = {"Inglês", "Espanhol", "Francês"}
LETRAS = {"A", "B", "C", "D"}
ARQ_MANIFESTO = Path(__file__).resolve().parent / "dados" / "cache" / "manifesto.json"
TIPOS_RESPOSTA = {"gabarito", "padrao_resposta"}


def pasta_url(url):
    return (url or "").rsplit("/", 1)[0]


def chave_edicao(ano, fase):
    return (ano, fase or "geral")


def eh_retificado(url):
    return bool(re.search(r"retificad|alterad|corrigid|final",
                          (url or "").rsplit("/", 1)[-1], re.IGNORECASE))


def _ler_producao():
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

    q = coletar("questoes_uerj", "id,prova_id,numero,disciplina,resposta,alternativas")
    p = coletar("provas_uerj", "id,hash_sha256,ano,tipo,fase")
    return q, p


def _mapas_de_gabarito(manifesto):
    """Reproduz main.py (edição + pasta) SEM o descarte da linha ~168.

    Devolve (por_edicao, por_pasta): dicts de {numero: letra}.
    Retificados por último para prevalecerem.
    """
    gabs = [m for m in manifesto.values() if m.get("tipo") == "gabarito"]
    gabs.sort(key=lambda m: eh_retificado(m.get("url", "")))
    por_edicao, por_pasta = defaultdict(dict), defaultdict(dict)
    for g in gabs:
        try:
            mapa, edicao = extrair_gabarito(g)
        except Exception as e:  # noqa: BLE001
            print(f"# aviso: extrair_gabarito falhou em {g.get('url')}: {e}",
                  file=sys.stderr)
            continue
        if not mapa:
            continue
        # RESGATE: registra por pasta SEMPRE (mata o descarte prematuro).
        por_pasta[pasta_url(g.get("url", ""))].update(mapa)
        ano = g.get("ano") or edicao.get("ano")
        fase = g.get("fase") or edicao.get("fase")
        if ano:
            por_edicao[chave_edicao(ano, fase)].update(mapa)
    return por_edicao, por_pasta


def _resolver(prod_q, prod_p, manifesto):
    url_por_hash = {h: m.get("url") for h, m in manifesto.items()}
    por_edicao, por_pasta = _mapas_de_gabarito(manifesto)

    qs_por_prova = defaultdict(list)
    for q in prod_q:
        qs_por_prova[q["prova_id"]].append(q)

    proposto = []          # (id, letra, prova_id, numero, disc)
    validacao_ok = validacao_erro = 0
    erros = []             # (prova_id, numero, esperado, recuperado)
    provas_com_erro = set()
    cobertura = {}         # prova_id -> (nulls, propostos)

    for p in prod_p:
        pid = p["id"]
        respostas = por_edicao.get(chave_edicao(p.get("ano"), p.get("fase")))
        if not respostas:
            respostas = por_pasta.get(pasta_url(url_por_hash.get(p["hash_sha256"], "")))
        if not respostas:
            continue
        questoes = qs_por_prova.get(pid, [])
        repetidos = {n for n, v in Counter(q["numero"] for q in questoes).items()
                     if v > 1}
        for q in questoes:
            disc = q.get("disciplina")
            alt = q.get("alternativas")
            if disc in IDIOMAS or not (isinstance(alt, list) and len(alt) == 4):
                continue
            if q["numero"] in repetidos:
                continue
            letra = respostas.get(q["numero"])
            if letra not in LETRAS:
                continue
            atual = (q.get("resposta") or "").strip().upper()
            if atual:  # validação contra o que produção já tem
                if atual == letra:
                    validacao_ok += 1
                else:
                    validacao_erro += 1
                    erros.append((pid, q["numero"], atual, letra))
                    provas_com_erro.add(pid)

    # 2ª passada: só emite proposta para provas 100%% limpas na validação
    for p in prod_p:
        pid = p["id"]
        if pid in provas_com_erro:
            continue
        respostas = por_edicao.get(chave_edicao(p.get("ano"), p.get("fase")))
        if not respostas:
            respostas = por_pasta.get(pasta_url(url_por_hash.get(p["hash_sha256"], "")))
        if not respostas:
            continue
        questoes = qs_por_prova.get(pid, [])
        repetidos = {n for n, v in Counter(q["numero"] for q in questoes).items()
                     if v > 1}
        n_null = n_prop = 0
        for q in questoes:
            disc = q.get("disciplina")
            alt = q.get("alternativas")
            if disc in IDIOMAS or not (isinstance(alt, list) and len(alt) == 4):
                continue
            if q["numero"] in repetidos:
                continue
            if (q.get("resposta") or "").strip():
                continue
            n_null += 1
            letra = respostas.get(q["numero"])
            if letra in LETRAS:
                proposto.append((q["id"], letra, pid, q["numero"], disc))
                n_prop += 1
        if n_null:
            cobertura[pid] = (n_null, n_prop)

    proposto.sort()
    return proposto, dict(
        validacao_ok=validacao_ok, validacao_erro=validacao_erro,
        erros=erros[:30], provas_com_erro=sorted(provas_com_erro),
        cobertura=cobertura,
    )


def bloco_sql(proposto):
    linhas = [
        "",
        "-- ==========================================================================",
        "-- PARTE 13 — Recuperação de gabaritos de objetivas (gerada por gerar_part13.py)",
        "-- --------------------------------------------------------------------------",
        "-- Gabaritos-tabela antigos (nome sem ano/fase, conteúdo sem \"Vestibular",
        "-- Estadual\") eram descartados pelo pipeline antes do fallback por pasta, e",
        "-- a prova da mesma pasta ficava sem gabarito. Aqui a recuperação é cirúrgica",
        "-- (sem reimport, preserva IDs e a Part 12). Cada letra foi VALIDADA: o mesmo",
        "-- casamento reproduz 100% dos gabaritos que produção já tinha, 0 divergência.",
        "-- Idempotente e aditivo: `and resposta is null` nunca sobrescreve.",
        "-- Nenhuma questão de idioma entra aqui (idioma nunca tem gabarito).",
        f"-- Total: {len(proposto)} questões.",
        "-- ==========================================================================",
    ]
    for qid, letra, pid, numero, disc in proposto:
        linhas.append(
            f"update public.questoes_uerj set resposta = '{letra}' "
            f"where id = {qid} and resposta is null; "
            f"-- prova {pid} nº{numero} {disc or ''}".rstrip()
        )
    linhas.append("")
    return "\n".join(linhas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stat", action="store_true", help="só o resumo + validação")
    args = ap.parse_args()

    if not ARQ_MANIFESTO.exists():
        raise SystemExit(f"manifesto não encontrado: {ARQ_MANIFESTO}")
    manifesto = json.loads(ARQ_MANIFESTO.read_text(encoding="utf-8"))
    prod_q, prod_p = _ler_producao()
    proposto, info = _resolver(prod_q, prod_p, manifesto)

    print(f"# VALIDAÇÃO: {info['validacao_ok']} letras batem com produção, "
          f"{info['validacao_erro']} divergem", file=sys.stderr)
    if info["validacao_erro"]:
        print(f"# DIVERGÊNCIAS (prova,numero,producao,recuperado): {info['erros']}",
              file=sys.stderr)
        print(f"# provas excluídas por divergência: {info['provas_com_erro']}",
              file=sys.stderr)
    print(f"# Part 13: {len(proposto)} gabaritos recuperáveis", file=sys.stderr)
    print("# cobertura por prova (prova_id: nulls->propostos):", file=sys.stderr)
    for pid, (n_null, n_prop) in sorted(info["cobertura"].items()):
        marca = "" if n_null == n_prop else "  <- parcial"
        print(f"#   prova {pid}: {n_null} -> {n_prop}{marca}", file=sys.stderr)

    if args.stat:
        return 0
    if info["validacao_erro"]:
        raise SystemExit(
            "ABORTADO: houve divergência na validação — investigar antes de emitir."
        )
    print(bloco_sql(proposto))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
