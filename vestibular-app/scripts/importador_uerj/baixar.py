"""Download dos PDFs catalogados pelo crawler.

- Paralelo (ThreadPool), com retry e backoff exponencial.
- Deduplicação por SHA-256: o manifesto guarda o hash de tudo que já foi
  baixado; conteúdo repetido (mesmo sob URL diferente) não é salvo de novo.
- Validação: precisa começar com %PDF e abrir no PyMuPDF.
- Organização em disco: dados/downloads/<ano>/<tipo>/<fase>/<arquivo>.pdf
"""

import hashlib
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import fitz  # PyMuPDF
import requests

from config import (
    ARQ_MANIFESTO,
    DIR_DOWNLOADS,
    DOWNLOADS_PARALELOS,
    TENTATIVAS_DOWNLOAD,
    TIMEOUT_HTTP,
    USER_AGENT,
)

log = logging.getLogger("baixar")


def _nome_seguro(texto):
    limpo = re.sub(r"[^a-zA-Z0-9._-]+", "_", texto)[:120].strip("_")
    return limpo or "arquivo"


def carregar_manifesto():
    if ARQ_MANIFESTO.exists():
        return json.loads(ARQ_MANIFESTO.read_text(encoding="utf-8"))
    return {}


def salvar_manifesto(manifesto):
    ARQ_MANIFESTO.parent.mkdir(parents=True, exist_ok=True)
    ARQ_MANIFESTO.write_text(
        json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _validar_pdf(conteudo):
    if not conteudo.startswith(b"%PDF"):
        return 0
    try:
        with fitz.open(stream=conteudo, filetype="pdf") as doc:
            return doc.page_count
    except Exception:
        return 0


def _baixar_um(item, sessao):
    """Baixa 1 PDF com retries. Devolve (item, conteudo|None, erro|None)."""
    ultimo_erro = None
    for tentativa in range(1, TENTATIVAS_DOWNLOAD + 1):
        try:
            resp = sessao.get(item["url"], timeout=TIMEOUT_HTTP)
            resp.raise_for_status()
            return item, resp.content, None
        except requests.RequestException as erro:
            ultimo_erro = str(erro)
            time.sleep(2 ** tentativa)  # backoff: 2s, 4s, 8s
    return item, None, ultimo_erro


def baixar_catalogo(catalogo, progresso=None):
    """Baixa todos os itens ainda não presentes no manifesto.

    Devolve a lista de itens enriquecidos com {hash, caminho_local, paginas}.
    """
    manifesto = carregar_manifesto()
    urls_conhecidas = {m["url"] for m in manifesto.values()}
    pendentes = [i for i in catalogo if i["url"] not in urls_conhecidas]

    log.info(
        "%d PDFs no catálogo; %d já baixados; %d pendentes.",
        len(catalogo), len(catalogo) - len(pendentes), len(pendentes),
    )

    sessao = requests.Session()
    sessao.headers["User-Agent"] = USER_AGENT

    baixados, falhas = 0, 0
    with ThreadPoolExecutor(max_workers=DOWNLOADS_PARALELOS) as pool:
        futuros = [pool.submit(_baixar_um, item, sessao) for item in pendentes]
        for futuro in as_completed(futuros):
            item, conteudo, erro = futuro.result()
            if progresso:
                progresso.update(1)

            if conteudo is None:
                falhas += 1
                log.error("Download falhou (%s): %s", item["url"], erro)
                continue

            paginas = _validar_pdf(conteudo)
            if paginas == 0:
                falhas += 1
                log.error("PDF inválido/corrompido: %s", item["url"])
                continue

            hash_ = hashlib.sha256(conteudo).hexdigest()
            if hash_ in manifesto:
                # Conteúdo idêntico já salvo sob outra URL — só referencia.
                log.info("Duplicata por hash ignorada: %s", item["url"])
                manifesto[hash_].setdefault("urls_alternativas", []).append(item["url"])
                continue

            ano = item.get("ano") or "sem-ano"
            tipo = item.get("tipo") or "outro"
            fase = item.get("fase") or "geral"
            pasta = DIR_DOWNLOADS / str(ano) / tipo / fase
            pasta.mkdir(parents=True, exist_ok=True)
            nome = _nome_seguro(item["url"].rsplit("/", 1)[-1])
            caminho = pasta / nome
            caminho.write_bytes(conteudo)

            manifesto[hash_] = {
                **item,
                "hash": hash_,
                "caminho_local": str(caminho),
                "paginas": paginas,
                "tamanho": len(conteudo),
            }
            baixados += 1

    salvar_manifesto(manifesto)
    log.info("Downloads: %d novos, %d falhas.", baixados, falhas)
    return list(manifesto.values())
