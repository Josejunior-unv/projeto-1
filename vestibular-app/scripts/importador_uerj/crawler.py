"""Crawler do portal público da UERJ (DEPSEA / vestibular.uerj.br).

Percorre as páginas do site em largura (BFS), respeitando o domínio, e
cataloga todo link de PDF encontrado. Os anos NÃO são uma lista fixa:
são deduzidos do texto do link, da URL e do título da página — assim
novas edições entram no catálogo automaticamente.
"""

import json
import logging
import re
import time
from collections import deque
from urllib.parse import urljoin, urldefrag, urlparse

import requests
from bs4 import BeautifulSoup

from config import (
    ARQ_CATALOGO,
    BASE_URL,
    DOMINIOS_PERMITIDOS,
    MAX_PAGINAS,
    PAUSA_ENTRE_PAGINAS,
    PROFUNDIDADE_MAXIMA,
    TIMEOUT_HTTP,
    USER_AGENT,
)

log = logging.getLogger("crawler")

RE_ANO = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")

def _sem_acento(texto):
    import unicodedata
    return (
        unicodedata.normalize("NFD", texto or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


# O portal publica os anexos como /anexos/AAE/... onde AA = ano (26 -> 2026)
# e E = etapa (1 = 1º Exame de Qualificação, 2 = 2º EQ, 3 = Exame Discursivo).
RE_ANEXO = re.compile(r"/anexos/(\d{2})([123])/")

# Arquivos antigos moram em wp-content/uploads/AAAA/MM/ — esse AAAA é a DATA
# DE UPLOAD, não o ano da prova (uploads de 2019 têm provas de 2012 a 2020).
# O ano real vem do NOME do arquivo: "2015_1eq_prova.pdf", "Gabarito_2EQ_2020".
RE_UPLOADS = re.compile(r"/wp-content/uploads/\d{4}/\d{2}/", re.IGNORECASE)
RE_ANO_ARQUIVO = re.compile(r"\b(19[89]\d|20[0-4]\d)\b")
RE_FASE_ARQUIVO = re.compile(r"(?:^|[^a-z0-9])([12])\s*_?\s*(?:eq\b|exame|fase)", re.IGNORECASE)

# Documentos administrativos: nunca são prova/gabarito, mesmo que a página
# mencione "exame de qualificação" ao redor do link.
NEGATIVOS = [
    "edital", "manual", "calendario", "isencao", "resultado", "bairro",
    "procedimento", "cartao", "confirmacao", "classificacao", "convocacao",
    "concorrencia", "nota", "vaga", "matricula", "cronograma", "retificac",
    "comunicado", "documenta", "identidade", "cotas", "banca",
    # Concursos e processos que NÃO são o vestibular (poluíam o banco de
    # questões com conteúdo de outros certames):
    "cbmerj", "proficiencia", "listagem", "candidatos", "aptos", "programa",
    "transferencia", "t_ext", "reduzida", "simulado", "abmdp",
    # Documentos administrativos das pastas de anexo das provas:
    "orientacoes", "locais", "pvc",
    # Resultados/matrícula que moram nas MESMAS pastas /anexos/AAE/ das
    # provas: remanejamentos, reclassificações, autodeclarações, laudos.
    "remanej", "reclass", "class", "deferid", "autodec", "laudo",
]

# Listas de locais de prova por inicial do candidato ("A-B.pdf", "C-F.pdf",
# "L.pdf" — normalizado vira "a b pdf") e modelos de declaração ("dec_01").
# Nunca são prova.
RE_FAIXA_LETRAS = re.compile(
    r"(?:[a-z](?:\s+[a-z])?(?:\s+retificado\S*)?|dec\s+\d+|form\s+\S+)\s+pdf\s*"
)

ROTULO_DISCIPLINA = {
    "matematica": "Matemática", "fisica": "Física", "quimica": "Química",
    "biologia": "Biologia", "historia": "História", "geografia": "Geografia",
    "portugues": "Português", "literatura": "Português", "lpl": "Português",
    "lp ": "Português",  # "LP.pdf" normalizado vira "lp pdf"
    "ingles": "Inglês", "espanhol": "Espanhol", "frances": "Francês",
    "filosofia": "Filosofia", "sociologia": "Sociologia", "redacao": "Redação",
}


def classificar_item(texto_link, url, contexto=""):
    """Deduz (ano, tipo, fase, disciplina) de um link de PDF.

    Prioridade dos sinais: nome do arquivo > texto do link > contexto da
    página. O padrão /anexos/AAE/ dá ano+fase com precisão.
    """
    arquivo_cru = _sem_acento(url.rsplit("/", 1)[-1])
    # "_" e "-" contam como letra para o \b do regex e escondiam anos e
    # fases ("2015_1eq_prova.pdf" não casa \b2015\b): viram espaço.
    arquivo = re.sub(r"[_\-.]+", " ", arquivo_cru)
    alvo_link = _sem_acento(f"{texto_link} {arquivo}")
    # O caminho wp-content/uploads/AAAA/MM/ carrega a data de UPLOAD, que não
    # é o ano da prova — sai da URL antes de procurar anos no conjunto.
    url_sem_uploads = RE_UPLOADS.sub("/", url)
    alvo_tudo = _sem_acento(f"{texto_link} {url_sem_uploads} {contexto}")

    # ano + fase pelo número do anexo (sinal mais confiável do portal)
    ano, fase = None, None
    m = RE_ANEXO.search(url)
    if m:
        ano = 2000 + int(m.group(1))
        fase = {"1": "1EQ", "2": "2EQ", "3": "ED"}[m.group(2)]

    # 2º sinal: o NOME do arquivo ("2015_1eq_prova.pdf", "Gabarito_2EQ_2020").
    if ano is None:
        anos = RE_ANO_ARQUIVO.findall(arquivo)
        if anos:
            ano = int(max(anos))
    if fase is None:
        m_fase = RE_FASE_ARQUIVO.search(arquivo)
        if m_fase:
            fase = f"{m_fase.group(1)}EQ"

    # 3º sinal: texto do link + contexto da página (sem a data de upload).
    if ano is None:
        anos = RE_ANO.findall(alvo_tudo)
        if anos:
            ano = int(max(anos))
    if fase is None:
        if re.search(r"\b(1o|1º|primeiro)\s*(exame|eq)|\b1\s*eq\b", alvo_tudo):
            fase = "1EQ"
        elif re.search(r"\b(2o|2º|segundo)\s*(exame|eq)|\b2\s*eq\b", alvo_tudo):
            fase = "2EQ"
    # Exame Único (edição da pandemia): prova objetiva de fase única.
    if fase is None and re.search(r"exame\s*_?\s*unico", alvo_link):
        fase = "EU"

    # disciplina pelo nome do arquivo (provas discursivas por matéria)
    disciplina = None
    for chave, rotulo in ROTULO_DISCIPLINA.items():
        if chave in arquivo:
            disciplina = rotulo
            break

    tipo_prova = "discursivo" if fase == "ED" else "qualificacao"

    if any(n in alvo_link for n in NEGATIVOS) or RE_FAIXA_LETRAS.fullmatch(arquivo):
        tipo = "outro"
    elif "gabarito" in alvo_link:
        tipo = "gabarito"
    elif "/padroes/" in url.lower() or "padrao" in alvo_link:
        tipo = "padrao_resposta"
    elif (
        re.search(r"\bprovas?\b|exame", alvo_link)
        or "/provas/" in url.lower()
        or (disciplina and fase == "ED")
        # O padrão /anexos/AAE/ é usado quase só para material de prova; o
        # que não for (editais, cartões...) cai nos NEGATIVOS acima e o
        # conteúdo do PDF ainda é validado na extração ("Vestibular
        # Estadual" impresso).
        or fase in ("1EQ", "2EQ", "ED")
    ):
        tipo = tipo_prova
    elif "gabarito" in alvo_tudo:
        tipo = "gabarito"
    else:
        tipo = "outro"

    if tipo == "discursivo":
        fase = "ED"

    return ano, tipo, fase, disciplina


def rastrear(base_url=BASE_URL, max_paginas=MAX_PAGINAS):
    """Executa o crawl e devolve a lista de PDFs catalogados.

    Cada item: {url, texto, pagina_origem, ano, tipo, fase, disciplina}
    """
    sessao = requests.Session()
    sessao.headers["User-Agent"] = USER_AGENT

    visitadas = set()
    fila = deque([(base_url, 0)])
    catalogo = {}  # url do pdf -> item

    while fila and len(visitadas) < max_paginas:
        url, prof = fila.popleft()
        url = urldefrag(url).url
        if url in visitadas or prof > PROFUNDIDADE_MAXIMA:
            continue
        visitadas.add(url)

        try:
            resp = sessao.get(url, timeout=TIMEOUT_HTTP)
            if "text/html" not in resp.headers.get("Content-Type", ""):
                continue
            resp.raise_for_status()
        except requests.RequestException as erro:
            log.warning("Falha ao abrir %s: %s", url, erro)
            continue

        sopa = BeautifulSoup(resp.text, "html.parser")
        titulo_pagina = sopa.title.get_text(" ", strip=True) if sopa.title else ""

        for a in sopa.find_all("a", href=True):
            destino = urljoin(url, a["href"])
            destino = urldefrag(destino).url
            host = urlparse(destino).netloc

            texto_link = a.get_text(" ", strip=True)
            # Contexto = texto do link + item de lista/parágrafo que o contém.
            pai = a.find_parent(["li", "p", "td", "h1", "h2", "h3"])
            contexto = f"{texto_link} {pai.get_text(' ', strip=True) if pai else ''} {titulo_pagina}"

            if destino.lower().split("?")[0].endswith(".pdf"):
                if destino not in catalogo:
                    ano, tipo, fase, disciplina = classificar_item(
                        texto_link, destino, contexto
                    )
                    catalogo[destino] = {
                        "url": destino,
                        "texto": texto_link[:300],
                        "pagina_origem": url,
                        "ano": ano,
                        "tipo": tipo,
                        "fase": fase,
                        "disciplina": disciplina,
                    }
            elif host in DOMINIOS_PERMITIDOS:
                if destino not in visitadas:
                    fila.append((destino, prof + 1))

        time.sleep(PAUSA_ENTRE_PAGINAS)
        if len(visitadas) % 50 == 0:
            log.info(
                "%d páginas visitadas, %d PDFs no catálogo...",
                len(visitadas), len(catalogo),
            )

    itens = list(catalogo.values())
    log.info(
        "Crawl concluído: %d páginas visitadas, %d PDFs catalogados.",
        len(visitadas), len(itens),
    )

    ARQ_CATALOGO.parent.mkdir(parents=True, exist_ok=True)
    ARQ_CATALOGO.write_text(
        json.dumps(itens, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return itens


def carregar_catalogo():
    if ARQ_CATALOGO.exists():
        return json.loads(ARQ_CATALOGO.read_text(encoding="utf-8"))
    return []
