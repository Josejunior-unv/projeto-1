"""Extração de questões dos PDFs de prova da UERJ.

Estratégia em camadas:
1. PyMuPDF (fitz) extrai o texto de cada página — rápido e preciso.
2. Se a página vier vazia, tenta o pdfplumber (layout diferente).
3. Se AINDA vier vazia (prova escaneada), tenta OCR com pytesseract,
   quando instalado — caso contrário registra o aviso e segue.

A segmentação reconhece cabeçalhos "QUESTÃO 01" / "Questão 1" e divide
alternativas no padrão da UERJ: (A) ... (B) ... (C) ... (D).
Cada questão carrega: número, enunciado, alternativas, página, imagens
da(s) página(s) em que aparece e a URL original do PDF.
"""

import json
import logging
import re

import fitz  # PyMuPDF

from config import ARQ_EXTRACAO, DIR_IMAGENS

log = logging.getLogger("extrair")

RE_QUESTAO = re.compile(r"(?:^|\n)\s*QUEST[ÃA]O\s+(\d{1,3})\b", re.IGNORECASE)
RE_ALTERNATIVA = re.compile(r"\(([A-E])\)\s*")
# Gabaritos: linhas "01 - B", "01. B", "01 B", "1) C"...
RE_GABARITO = re.compile(r"\b(\d{1,3})\s*[-–.)\s]\s*([A-E])\b")

MIN_TEXTO_PAGINA = 30  # abaixo disso a página é tratada como "sem texto"


def _texto_pdfplumber(caminho, num_pagina):
    try:
        import pdfplumber

        with pdfplumber.open(caminho) as pdf:
            if num_pagina < len(pdf.pages):
                return pdf.pages[num_pagina].extract_text() or ""
    except Exception as erro:  # pdfplumber é a 2ª tentativa; falha não aborta
        log.debug("pdfplumber falhou em %s p.%d: %s", caminho, num_pagina, erro)
    return ""


def _texto_ocr(pagina_fitz):
    try:
        import pytesseract
        from PIL import Image
        import io

        pix = pagina_fitz.get_pixmap(dpi=200)
        imagem = Image.open(io.BytesIO(pix.tobytes("png")))
        return pytesseract.image_to_string(imagem, lang="por")
    except ImportError:
        log.warning(
            "Página sem texto e OCR indisponível (instale pytesseract + "
            "Tesseract-OCR para provas escaneadas)."
        )
    except Exception as erro:
        log.warning("OCR falhou: %s", erro)
    return ""


def _exportar_imagens(doc, num_pagina, prefixo):
    """Salva as figuras de uma página em dados/imagens. Devolve os caminhos."""
    caminhos = []
    try:
        for i, info in enumerate(doc[num_pagina].get_images(full=True)):
            xref = info[0]
            base = doc.extract_image(xref)
            if len(base["image"]) < 4096:
                continue  # descarta ícones/filetes decorativos
            nome = f"{prefixo}_p{num_pagina + 1}_{i}.{base['ext']}"
            destino = DIR_IMAGENS / nome
            destino.write_bytes(base["image"])
            caminhos.append(str(destino))
    except Exception as erro:
        log.debug("Extração de imagens falhou p.%d: %s", num_pagina, erro)
    return caminhos


def _dividir_alternativas(corpo):
    """Separa enunciado e alternativas (A)-(E) do corpo de uma questão."""
    partes = RE_ALTERNATIVA.split(corpo)
    if len(partes) < 5:  # sem pelo menos 2 alternativas -> discursiva/aberta
        return corpo.strip(), []

    enunciado = partes[0].strip()
    alternativas = []
    for i in range(1, len(partes) - 1, 2):
        letra = partes[i]
        texto = re.sub(r"\s+", " ", partes[i + 1]).strip()
        alternativas.append({"letra": letra, "texto": texto})
    return enunciado, alternativas


def extrair_questoes(entrada_manifesto, prefixo_imagens):
    """Extrai as questões de um PDF de PROVA. Devolve a lista de questões."""
    caminho = entrada_manifesto["caminho_local"]
    doc = fitz.open(caminho)

    # Texto por página (com as camadas de fallback).
    paginas = []
    for n in range(doc.page_count):
        texto = doc[n].get_text("text") or ""
        if len(texto.strip()) < MIN_TEXTO_PAGINA:
            texto = _texto_pdfplumber(caminho, n) or texto
        if len(texto.strip()) < MIN_TEXTO_PAGINA:
            texto = _texto_ocr(doc[n]) or texto
        paginas.append(texto)

    # Concatena com marcadores de página para rastrear a origem.
    MARCA = "\f"
    completo = MARCA.join(paginas)

    def pagina_do_indice(idx):
        return completo.count(MARCA, 0, idx) + 1

    ocorrencias = list(RE_QUESTAO.finditer(completo))
    questoes = []
    for i, m in enumerate(ocorrencias):
        inicio = m.end()
        fim = ocorrencias[i + 1].start() if i + 1 < len(ocorrencias) else len(completo)
        corpo = completo[inicio:fim].replace(MARCA, "\n").strip()
        if len(corpo) < 20:
            continue  # cabeçalho órfão (sumário, capa...)

        numero = int(m.group(1))
        enunciado, alternativas = _dividir_alternativas(corpo)
        pag_ini = pagina_do_indice(m.start())
        pag_fim = pagina_do_indice(fim - 1)

        imagens = []
        for p in range(pag_ini - 1, min(pag_fim, doc.page_count)):
            imagens += _exportar_imagens(doc, p, f"{prefixo_imagens}_q{numero}")

        questoes.append({
            "numero": numero,
            "enunciado": re.sub(r"[ \t]+", " ", enunciado).strip(),
            "alternativas": alternativas,
            "pagina": pag_ini,
            "imagens": imagens,
            "url_original": entrada_manifesto["url"],
        })

    doc.close()

    # Remove números repetidos (cabeçalho re-detectado em rodapé etc.).
    vistos, unicas = set(), []
    for q in questoes:
        if q["numero"] in vistos:
            continue
        vistos.add(q["numero"])
        unicas.append(q)

    log.info(
        "%s -> %d questões extraídas.",
        entrada_manifesto.get("texto") or caminho, len(unicas),
    )
    return unicas


def extrair_gabarito(entrada_manifesto):
    """Extrai {numero: letra} de um PDF de gabarito (melhor esforço)."""
    caminho = entrada_manifesto["caminho_local"]
    try:
        doc = fitz.open(caminho)
        texto = "\n".join(doc[n].get_text("text") or "" for n in range(doc.page_count))
        doc.close()
    except Exception as erro:
        log.error("Não abriu gabarito %s: %s", caminho, erro)
        return {}

    respostas = {}
    for m in RE_GABARITO.finditer(texto):
        numero, letra = int(m.group(1)), m.group(2)
        if 1 <= numero <= 120 and numero not in respostas:
            respostas[numero] = letra
    log.info("Gabarito %s -> %d respostas.", entrada_manifesto["url"], len(respostas))
    return respostas


def salvar_extracao(resultado):
    ARQ_EXTRACAO.parent.mkdir(parents=True, exist_ok=True)
    ARQ_EXTRACAO.write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
