"""Extração de questões dos PDFs de prova da UERJ.

Estratégia em camadas:
1. PyMuPDF (fitz) extrai os BLOCOS de cada página e os reordena por
   coluna (os PDFs da UERJ têm 2 colunas; a ordem "crua" embaralha as
   questões e era a causa nº 1 de questões fundidas/erradas).
2. Se a página vier vazia, tenta o pdfplumber (layout diferente).
3. Se AINDA vier vazia (prova escaneada), tenta OCR com pytesseract,
   quando instalado — caso contrário registra o aviso e segue.

Particularidades do layout da UERJ tratadas aqui:
- Provas antigas (≤2020) têm o rótulo "QUESTÃO" e o número em blocos
  separados na MARGEM esquerda → são fundidos num cabeçalho sintético.
- Números de linha dos textos (5, 10, 15...) ficam na margem e poluíam
  os enunciados → blocos puramente numéricos de margem são descartados.
- Cada página tem um rodapé com a ÁREA ("Linguagens", "Matemática",
  "Ciências da Natureza", "Ciências Humanas") e, nas páginas de língua
  estrangeira, o idioma ("Inglês", "Espanhol", "Francês") → vira o
  sinal principal de classificação da questão.
- Banners "AS QUESTÕES 09 A 22 REFEREM-SE..." pertencem às questões
  SEGUINTES → o texto do banner em diante é movido para a próxima.
- As questões de língua estrangeira repetem os números (23–27 em
  inglês, espanhol e francês) → todas são mantidas, diferenciadas
  pelo idioma.

A segmentação reconhece cabeçalhos "QUESTÃO 01" / "Questão 1" e divide
alternativas no padrão da UERJ: (A) ... (B) ... (C) ... (D).
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
# Banner que introduz um bloco de questões ("AS QUESTÕES 09 A 22
# REFEREM-SE AO ROMANCE..."): pertence à PRÓXIMA questão, não à anterior.
RE_BANNER = re.compile(
    r"(?:AS\s+)?QUEST[ÕO]ES\s+(?:DE\s+N[ÚU]MEROS?\s+)?\d{1,3}\s+(?:A|E)\s+\d{1,3}",
    re.IGNORECASE,
)
# Rodapé/cabeçalho de área presente em todas as páginas das provas de
# qualificação. Ex.: "Linguagens", "Linguagens  Espanhol", "Ciências da
# Natureza, Matemática e suas Tecnologias".
RE_AREA = re.compile(
    r"(?im)^[ \t]*(Linguagens|Matem[áa]tica|Ci[êe]ncias?\s+da\s+Natureza"
    r"|Ci[êe]ncias?\s+Humanas|L[íi]ngua\s+Estrangeira)"
    r"([^\n]{0,60})$"
)
RE_IDIOMA = re.compile(r"(Ingl[êe]s|Espanhol|Franc[êe]s)", re.IGNORECASE)
# Ano/fase impressos na capa e no rodapé: "Vestibular Estadual 2015",
# "1ª fase Exame de Qualificação", "Exame Discursivo", "Exame Único".
RE_EDICAO_ANO = re.compile(r"Vestibular\s+Estadual\s+(\d{4})", re.IGNORECASE)
RE_EDICAO_FASE = re.compile(
    r"(1|2)\s*[ªºo]?\s*(?:fase\s+)?Exame\s+de\s+Qualifica|"
    r"(Exame\s+Discursivo)|(Exame\s+[ÚU]nico)",
    re.IGNORECASE,
)

MIN_TEXTO_PAGINA = 30  # abaixo disso a página é tratada como "sem texto"

# Linhas de cabeçalho/rodapé dos PDFs da UERJ que poluem o enunciado.
RE_LINHA_RUIDO = re.compile(
    r"^\s*("
    r"desenvolvimento e resposta:?|"
    r"rascunho|"
    r"vestibular estadual\s*\d{0,4}.*|"
    r"exame discursivo|exame de qualifica\S*|exame [úu]nico.*|"
    r"universidade do estado do rio de janeiro|"
    r"matem[áa]tica|f[íi]sica|qu[íi]mica|biologia|hist[óo]ria|geografia|"
    r"portugu[êe]s|l[íi]ngua portuguesa.*|reda[çc][ãa]o|ingl[êe]s|espanhol|"
    r"franc[êe]s|filosofia|sociologia|"
    r"linguagens(\s+(ingl[êe]s|espanhol|franc[êe]s))?|"
    r"ci[êe]ncias? da natureza(,[^\n]*)?|ci[êe]ncias? humanas[^\n]{0,30}|"
    r"\d{1,3}"
    r")\s*$",
    re.IGNORECASE,
)

ROTULO_AREA = {
    "linguagens": "Linguagens",
    "matematica": "Matemática",
    "ciencias da natureza": "Ciências da Natureza",
    "ciencias humanas": "Ciências Humanas",
    "lingua estrangeira": "Linguagens",  # ED de língua estrangeira
}


def _sem_acento(texto):
    import unicodedata

    return (
        unicodedata.normalize("NFD", texto or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


def _limpar_enunciado(texto):
    """Remove linhas de cabeçalho/rodapé sem tocar no conteúdo real."""
    linhas = [l for l in texto.splitlines() if not RE_LINHA_RUIDO.match(l)]
    limpo = "\n".join(linhas)
    return re.sub(r"\n{3,}", "\n\n", limpo).strip()


def _texto_ordenado(pagina):
    """Texto da página em ORDEM DE LEITURA (coluna esquerda → direita).

    Também funde os rótulos de margem "QUESTÃO" + "NN" (layout antigo) em
    um cabeçalho inline e descarta números de linha soltos da margem.
    """
    brutos = [
        list(b) for b in pagina.get_text("blocks")
        if b[6] == 0 and (b[4] or "").strip()
    ]
    if not brutos:
        return ""

    largura = pagina.rect.width
    meio = largura / 2

    # 1) Rótulos de margem: bloco "QUESTÃO" isolado + bloco numérico próximo.
    rotulos = [b for b in brutos if re.fullmatch(r"QUEST[ÃA]O", b[4].strip(), re.I)]
    numericos = [b for b in brutos if re.fullmatch(r"\d{1,3}", b[4].strip())]
    consumidos = set()
    for rot in rotulos:
        rx = (rot[0] + rot[2]) / 2
        ry = (rot[1] + rot[3]) / 2
        candidato, menor = None, 75.0
        for num in numericos:
            if id(num) in consumidos:
                continue
            dist = abs((num[0] + num[2]) / 2 - rx) + abs((num[1] + num[3]) / 2 - ry)
            if dist < menor:
                candidato, menor = num, dist
        if candidato is not None:
            rot[4] = f"QUESTÃO {int(candidato[4].strip()):02d}\n"
            # O rótulo é vertical e desce além do início da questão: o
            # cabeçalho sintético assume o topo do PAR, senão ele seria
            # ordenado depois do 1º parágrafo do enunciado.
            rot[1] = min(rot[1], candidato[1]) - 1
            consumidos.add(id(candidato))

    # 2) Números de linha/página soltos na margem: fora do fluxo de leitura.
    blocos = []
    for b in brutos:
        if id(b) in consumidos:
            continue
        eh_numero = re.fullmatch(r"\d{1,3}", b[4].strip())
        estreito = (b[2] - b[0]) < 45
        if eh_numero and estreito:
            continue  # número de linha do texto ou número de página
        blocos.append(b)

    # 3) Ordem de leitura: coluna (banners de largura total contam como
    #    esquerda) e altura. Páginas de coluna única caem no caso "col 0".
    def chave(b):
        if (b[2] - b[0]) > largura * 0.6:
            col = 0
        else:
            col = 0 if (b[0] + b[2]) / 2 < meio else 1
        return (col, round(b[1], 1), b[0])

    return "\n".join(b[4].strip("\n") for b in sorted(blocos, key=chave))


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


def _area_da_pagina(texto_pagina):
    """(area, idioma) impressos no cabeçalho/rodapé de uma página."""
    area, idioma = None, None
    for m in RE_AREA.finditer(texto_pagina):
        chave = _sem_acento(m.group(1)).strip()
        chave = re.sub(r"\s+", " ", chave)
        rotulo = ROTULO_AREA.get(chave)
        if not rotulo:
            continue
        area = rotulo
        resto = m.group(2) or ""
        # "Ciências da Natureza, Matemática e suas Tecnologias" (provas
        # antigas): o bloco mistura as duas áreas.
        if rotulo == "Ciências da Natureza" and re.search(
            r"matem[áa]tica", resto, re.I
        ):
            area = "Ciências da Natureza e Matemática"
        m_idioma = RE_IDIOMA.search(resto)
        if m_idioma:
            idioma = _sem_acento(m_idioma.group(1))
    if idioma:
        idioma = {"ingles": "Inglês", "espanhol": "Espanhol", "frances": "Francês"}[
            idioma
        ]
    return area, idioma


def inferir_edicao(paginas_texto):
    """(ano, fase, é_vestibular) impressos no próprio PDF.

    Toda prova do vestibular imprime "Vestibular Estadual AAAA" no rodapé
    ou na capa; os PDFs de OUTROS certames hospedados no mesmo portal
    (CBMERJ, proficiência, mestrado, transferência) não imprimem — esse é
    o sinal usado para mantê-los fora do banco de questões.
    """
    amostra = "\n".join(paginas_texto[:3])
    ano, fase = None, None
    m = RE_EDICAO_ANO.search(amostra)
    if m:
        ano = int(m.group(1))
    eh_vestibular = bool(
        m or re.search(r"vestibular\s+estadual", amostra, re.IGNORECASE)
    )
    m = RE_EDICAO_FASE.search(amostra)
    if m:
        if m.group(1):
            fase = f"{m.group(1)}EQ"
        elif m.group(2):
            fase = "ED"
        elif m.group(3):
            fase = "EU"
    return ano, fase, eh_vestibular


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
    """Separa enunciado e alternativas (A)-(E) do corpo de uma questão.

    Só aceita a sequência ESTRITA a partir de (A): A, B, C, D[, E]. Uma
    letra repetida ou fora de ordem indica outra questão fundida ou "(A)"
    citado no texto — tudo dali em diante é descartado do card e o caso é
    sinalizado para o log.
    """
    partes = RE_ALTERNATIVA.split(corpo)
    if len(partes) < 5:  # sem pelo menos 2 alternativas -> discursiva/aberta
        return corpo.strip(), [], False

    enunciado = partes[0].strip()
    alternativas = []
    esperada = "A"
    houve_corte = False
    for i in range(1, len(partes) - 1, 2):
        letra = partes[i]
        if letra != esperada:
            houve_corte = True
            break
        texto = re.sub(r"\s+", " ", partes[i + 1]).strip()
        alternativas.append({"letra": letra, "texto": texto})
        esperada = chr(ord(esperada) + 1)
        if esperada > "E":
            break

    if len(alternativas) < 2:
        return corpo.strip(), [], houve_corte
    return enunciado, alternativas, houve_corte


def extrair_questoes(entrada_manifesto, prefixo_imagens):
    """Extrai as questões de um PDF de PROVA.

    Devolve (questoes, edicao) onde edicao = {"ano", "fase"} inferidos do
    conteúdo do PDF (None quando não impressos).
    """
    caminho = entrada_manifesto["caminho_local"]
    doc = fitz.open(caminho)

    # Texto por página (com as camadas de fallback) + área/idioma da página.
    paginas, areas = [], []
    for n in range(doc.page_count):
        texto = _texto_ordenado(doc[n])
        if len(texto.strip()) < MIN_TEXTO_PAGINA:
            texto = _texto_pdfplumber(caminho, n) or texto
        if len(texto.strip()) < MIN_TEXTO_PAGINA:
            texto = _texto_ocr(doc[n]) or texto
        paginas.append(texto)
        areas.append(_area_da_pagina(doc[n].get_text("text") or texto))

    edicao_ano, edicao_fase, eh_vestibular = inferir_edicao(paginas)

    # Concatena com marcadores de página para rastrear a origem. Cada página
    # termina em "\n" para que um cabeçalho "QUESTÃO NN" no TOPO da página
    # seguinte ainda case com o (?:^|\n) do regex.
    MARCA = "\f"
    completo = MARCA.join(f"{t}\n" for t in paginas)

    def pagina_do_indice(idx):
        return completo.count(MARCA, 0, idx) + 1

    ocorrencias = list(RE_QUESTAO.finditer(completo))
    questoes = []
    pendente_proxima = ""  # banner deslocado p/ a questão seguinte
    for i, m in enumerate(ocorrencias):
        inicio = m.end()
        fim = ocorrencias[i + 1].start() if i + 1 < len(ocorrencias) else len(completo)
        corpo = completo[inicio:fim].replace(MARCA, "\n").strip()

        contexto_bloco = pendente_proxima
        pendente_proxima = ""
        # Banner "AS QUESTÕES 09 A 22 REFEREM-SE..." no MEIO do corpo:
        # tudo dele em diante introduz o bloco seguinte.
        m_banner = RE_BANNER.search(corpo)
        if m_banner and m_banner.start() > 0:
            pendente_proxima = corpo[m_banner.start():].strip()
            corpo = corpo[: m_banner.start()].strip()

        if len(corpo) < 20:
            continue  # cabeçalho órfão (sumário, capa...)

        numero = int(m.group(1))
        enunciado, alternativas, houve_corte = _dividir_alternativas(corpo)
        if houve_corte:
            log.warning(
                "%s: questão %d com alternativas fora de sequência — "
                "conteúdo excedente descartado.",
                entrada_manifesto.get("texto") or caminho, numero,
            )
        if contexto_bloco:
            enunciado = f"{contexto_bloco}\n\n{enunciado}".strip()

        pag_ini = pagina_do_indice(m.start())
        pag_fim = pagina_do_indice(fim - 1)
        area, idioma = areas[pag_ini - 1] if pag_ini - 1 < len(areas) else (None, None)

        imagens = []
        for p in range(pag_ini - 1, min(pag_fim, doc.page_count)):
            imagens += _exportar_imagens(doc, p, f"{prefixo_imagens}_q{numero}")

        questoes.append({
            "numero": numero,
            "enunciado": re.sub(r"[ \t]+", " ", _limpar_enunciado(enunciado)).strip(),
            "alternativas": alternativas,
            "pagina": pag_ini,
            "area": area,
            "idioma": idioma,
            "imagens": imagens,
            "url_original": entrada_manifesto["url"],
        })

    doc.close()

    # Remove repetições reais (cabeçalho re-detectado em rodapé etc.), mas
    # PRESERVA as versões por idioma (23–27 em inglês/espanhol/francês).
    vistos, unicas = set(), []
    for q in questoes:
        chave = (q["numero"], q["idioma"])
        if chave in vistos:
            continue
        vistos.add(chave)
        unicas.append(q)

    # Questões sem conteúdo útil (só cabeçalho de seção, capa etc.) saem.
    validas = [
        q for q in unicas
        if q["alternativas"] or len(q["enunciado"]) >= 40
    ]

    log.info(
        "%s -> %d questões extraídas (%d descartadas por conteúdo vazio).",
        entrada_manifesto.get("texto") or caminho,
        len(validas), len(unicas) - len(validas),
    )
    return validas, {
        "ano": edicao_ano,
        "fase": edicao_fase,
        "vestibular": eh_vestibular,
        "tem_texto": any(len(t.strip()) >= MIN_TEXTO_PAGINA for t in paginas),
    }


def _gabarito_por_sequencia(texto):
    """{numero: letra} casando runs de números com runs de letras.

    Nos gabaritos de 2024+ os números saem numa coluna e as letras na
    coluna seguinte: em texto corrido vira "1 2 3 ... 22 B D C ... A".
    Números repetidos (23–27 das línguas estrangeiras) ficam com a
    PRIMEIRA ocorrência — mas o pipeline nem aplica gabarito a questões
    de idioma, porque cada língua tem respostas próprias.
    """
    tokens = texto.split()
    runs = []  # (tipo, lista)
    for t in tokens:
        if re.fullmatch(r"\d{1,3}", t) and 1 <= int(t) <= 120:
            item = ("n", int(t))
        elif re.fullmatch(r"[A-E]", t):
            item = ("l", t)
        else:
            runs.append(None)  # quebra qualquer run em andamento
            continue
        if runs and runs[-1] and runs[-1][0] == item[0]:
            runs[-1][1].append(item[1])
        else:
            runs.append((item[0], [item[1]]))

    runs = [r for r in runs if r]
    respostas = {}
    for i, (tipo, numeros) in enumerate(runs):
        if tipo != "n" or len(numeros) < 4 or i + 1 >= len(runs):
            continue
        tipo2, letras = runs[i + 1]
        if tipo2 == "l" and len(letras) == len(numeros):
            for n, letra in zip(numeros, letras):
                respostas.setdefault(n, letra)
    return respostas


def extrair_gabarito(entrada_manifesto):
    """Extrai {numero: letra} de um PDF de gabarito.

    Os gabaritos da UERJ são TABELAS (números numa linha, letras logo
    abaixo), então a estratégia principal é espacial: para cada número,
    procura a letra A–E mais próxima abaixo dele. Se render pouca coisa
    (layout diferente), cai para o regex linear "01 - B".

    Devolve (respostas, edicao) — edicao com ano/fase impressos no PDF.
    """
    caminho = entrada_manifesto["caminho_local"]
    try:
        doc = fitz.open(caminho)
    except Exception as erro:
        log.error("Não abriu gabarito %s: %s", caminho, erro)
        return {}, {"ano": None, "fase": None, "vestibular": False}

    respostas = {}
    texto_completo = []
    for pagina in doc:
        texto_completo.append(pagina.get_text("text") or "")
        palavras = pagina.get_text("words")  # (x0, y0, x1, y1, texto, ...)
        numeros = [
            ((w[0] + w[2]) / 2, w[3], int(w[4]))
            for w in palavras
            if re.fullmatch(r"\d{1,3}", w[4]) and 1 <= int(w[4]) <= 120
        ]
        letras = [
            ((w[0] + w[2]) / 2, w[1], w[4].upper())
            for w in palavras
            if re.fullmatch(r"[A-Ea-e]", w[4])
        ]
        for nx, ny, n in numeros:
            candidatas = [
                (abs(lx - nx) + 0.3 * (ly - ny), letra)
                for lx, ly, letra in letras
                if 0 < ly - ny < 40 and abs(lx - nx) < 12
            ]
            if candidatas and n not in respostas:
                respostas[n] = min(candidatas)[1]
    doc.close()

    if len(respostas) < 20:
        # Layout "coluna de números seguida de coluna de letras" (2024+):
        # em ordem de leitura, um run de N números consecutivos é seguido
        # por um run de N letras — casa por posição. Runs curtos (<4) são
        # ignorados para não confundir com datas/rodapés.
        por_sequencia = _gabarito_por_sequencia("\n".join(texto_completo))
        if len(por_sequencia) > len(respostas):
            respostas = por_sequencia

    if len(respostas) < 5:  # nada reconhecido -> tenta o formato linear
        for m in RE_GABARITO.finditer("\n".join(texto_completo)):
            numero, letra = int(m.group(1)), m.group(2)
            if 1 <= numero <= 120 and numero not in respostas:
                respostas[numero] = letra

    edicao_ano, edicao_fase, eh_vestibular = inferir_edicao(texto_completo)
    log.info("Gabarito %s -> %d respostas.", entrada_manifesto["url"], len(respostas))
    return respostas, {
        "ano": edicao_ano,
        "fase": edicao_fase,
        "vestibular": eh_vestibular,
    }


def salvar_extracao(resultado):
    ARQ_EXTRACAO.parent.mkdir(parents=True, exist_ok=True)
    ARQ_EXTRACAO.write_text(
        json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
