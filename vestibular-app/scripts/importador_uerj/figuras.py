"""Extração de figuras das questões da UERJ (renderização de região).

MOTIVAÇÃO
    O `extrair.py` só captura imagens RASTER embutidas (`doc.extract_image`).
    A maioria dos gráficos/tabelas/mapas/diagramas da UERJ é VETORIAL e passava
    batido — ~391 questões referenciavam uma figura que não estava no banco.
    Aqui a figura é RENDERIZADA a partir da sua região na página
    (`page.get_pixmap(clip=bbox)`), o que captura vetor E raster com os rótulos.

ESTRATÉGIA (validada visualmente em jul/2026)
    1. Marcadores "Questão NN" definem BANDAS verticais por questão.
    2. A coluna é inferida dos PRÓPRIOS marcadores (evita falso-positivo de
       2 colunas em páginas frontais, onde o marcador fica na margem e o
       conteúdo à direita — o que cortava figuras no meio).
    3. Dentro da banda, une vetores + raster relevantes; aceita figura fina
       larga (timelines) além de área mínima; e expande o bbox para incluir
       rótulos-texto curtos adjacentes (nomes de eixo, títulos, fontes).

ESTADO (jul/2026) — PROTÓTIPO VALIDADO, NÃO INTEGRADO
    ✅ Layouts MODERNOS (2013, 2021+): excelente. Validado por leitura visual:
       mapas (raster), timeline "Divisão da História" (vetor fino + rótulos),
       triângulo de geometria. Prova 2025/2EQ: 22 figuras coerentes.
    ❌ Layouts ANTIGOS (≤2020, ex. 2018): 0 figuras — o marcador "QUESTÃO" fica
       na MARGEM (vertical, em blocos separados) e `_marcadores` não o funde.
       PRÓXIMO PASSO: reusar a fusão de marcador de margem que o
       `extrair._texto_ordenado` já faz, em vez de duplicar aqui.
    ⚠️ Ainda NÃO chamado pelo `extrair.extrair_questoes` — integrar só depois de
       cobrir os layouts antigos e rodar QA visual no corpo inteiro. Reimportar
       com isto meio pronto daria figuras inconsistentes (pior que ausente).

Uso de teste (rende as figuras de um PDF para inspeção):
    python figuras.py caminho/da/prova.pdf  ->  dados/imagens/_figtest/
"""

import re

import fitz  # PyMuPDF

RE_Q_INLINE = re.compile(r"QUEST[ÃA]O\s*\n?\s*(\d{1,3})", re.IGNORECASE)


def _marcadores(page):
    """[(numero, x_centro, y_topo)] dos rótulos 'Questão NN' da página.

    Funde o caso em que 'Questão' e o número saem em blocos separados
    (layout frontal). NÃO cobre ainda o rótulo de margem vertical dos PDFs
    antigos (≤2020) — ver docstring do módulo.
    """
    blocks = [list(b) for b in page.get_text("blocks") if b[6] == 0]
    marks, usados = [], set()
    for i, b in enumerate(blocks):
        m = RE_Q_INLINE.search(b[4] or "")
        if m:
            marks.append([int(m.group(1)), (b[0] + b[2]) / 2, b[1]])
            usados.add(i)
    rot = [
        i for i, b in enumerate(blocks)
        if i not in usados
        and re.fullmatch(r"QUEST[ÃA]O\s*", (b[4] or "").strip(), re.IGNORECASE)
    ]
    num = [
        i for i, b in enumerate(blocks)
        if re.fullmatch(r"\d{1,3}", (b[4] or "").strip())
    ]
    for ri in rot:
        rb = blocks[ri]
        rx, ry = (rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2
        best, bd = None, 80
        for ni in num:
            if ni in usados:
                continue
            nb = blocks[ni]
            d = abs((nb[0] + nb[2]) / 2 - rx) + abs((nb[1] + nb[3]) / 2 - ry)
            if d < bd:
                best, bd = ni, d
        if best is not None:
            nb = blocks[best]
            marks.append([int(nb[4].strip()), rx, min(rb[1], nb[1])])
            usados.add(best)
    return marks


def _duas_colunas(page, marks):
    """2 colunas só quando HÁ marcador na metade esquerda E na direita."""
    meio = page.rect.width / 2
    esq = any(mx < meio * 0.9 for _, mx, _ in marks)
    dire = any(mx > meio * 1.1 for _, mx, _ in marks)
    return esq and dire


def _graficos(page, x0, x1, y0, y1):
    """(bboxes, n_vetores, tem_raster) da região.

    Ignora a MOLDURA da questão (retângulo grande que ~ocupa a coluna toda):
    no layout antigo cada questão fica numa caixa com borda, que sozinha não
    é figura. Uma figura real = raster OU vários traços vetoriais distintos.
    """
    larg_col = x1 - x0
    g, n_vetores = [], 0
    for d in page.get_drawings():
        r = d["rect"]
        if not (r.width > 5 and r.height > 5 and r.x0 >= x0 - 3 and r.x1 <= x1 + 3
                and r.y0 >= y0 - 3 and r.y1 <= y1 + 3):
            continue
        # moldura/coluna: retângulo que preenche quase toda a largura da coluna
        if r.width > larg_col * 0.85 and r.height > 60 and len(d.get("items", [])) <= 2:
            continue
        g.append(fitz.Rect(r))
        n_vetores += 1
    tem_raster = False
    for img in page.get_images(full=True):
        try:
            for r in page.get_image_rects(img[0]):
                if (r.width > 12 and r.height > 12 and r.x0 >= x0 - 3
                        and r.x1 <= x1 + 3 and r.y0 >= y0 - 3 and r.y1 <= y1 + 3):
                    g.append(fitz.Rect(r))
                    tem_raster = True
        except Exception:
            pass
    return g, n_vetores, tem_raster


def figuras_da_pagina(page):
    """{numero: bbox} das figuras detectadas na página (para render/clip)."""
    marks = _marcadores(page)
    if not marks:
        return {}
    duas = _duas_colunas(page, marks)
    meio = page.rect.width / 2

    def col(mx):
        return 0 if mx < meio else 1

    out = {}
    for (num, mx, my) in marks:
        if duas:
            x0, x1 = (0, meio) if col(mx) == 0 else (meio, page.rect.width)
            c = col(mx)
        else:
            x0, x1, c = 0, page.rect.width, 0
        # y da banda: até o próximo marcador na MESMA coluna
        y1 = page.rect.height - 38
        for (_n2, mx2, my2) in marks:
            mesma = (col(mx2) == c) if duas else True
            if mesma and my + 8 < my2 < y1:
                y1 = my2
        g, n_vetores, tem_raster = _graficos(page, x0, x1, my, y1)
        if not g:
            continue
        # figura real = tem raster OU vários traços vetoriais (não só a moldura)
        if not tem_raster and n_vetores < 3:
            continue
        area = sum(r.width * r.height for r in g)
        bb = g[0]
        for r in g[1:]:
            bb |= r
        # aceita figura fina larga (timeline) OU área relevante
        if not (area >= 2500 or (bb.width >= 180 and bb.height >= 22)):
            continue
        # inclui RÓTULOS: blocos de texto curtos que tocam a figura (até 22px)
        for tb in page.get_text("blocks"):
            if tb[6] != 0:
                continue
            txt = (tb[4] or "").strip()
            if not txt or len(txt) > 60:
                continue
            tr = fitz.Rect(tb[:4])
            perto = (tr.y1 > bb.y0 - 22 and tr.y0 < bb.y1 + 22
                     and tr.x1 > bb.x0 - 10 and tr.x0 < bb.x1 + 10)
            if perto and tr.y0 >= my - 2:
                bb |= tr
        bb = fitz.Rect(x0 + 3, bb.y0 - 6, x1 - 3, bb.y1 + 6) & page.rect
        if bb.width < 50 or bb.height < 28:
            continue
        out[num] = bb
    return out


if __name__ == "__main__":
    import sys
    from pathlib import Path

    caminho = sys.argv[1] if len(sys.argv) > 1 else None
    if not caminho:
        print("uso: python figuras.py caminho/da/prova.pdf")
        raise SystemExit(1)
    saida = Path(__file__).resolve().parent / "dados" / "imagens" / "_figtest"
    saida.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(caminho)
    total = 0
    for n, pg in enumerate(doc):
        for numero, bb in figuras_da_pagina(pg).items():
            pg.get_pixmap(clip=bb, dpi=150).save(
                str(saida / f"q{numero:02d}_p{n + 1}.png")
            )
            total += 1
    doc.close()
    print(f"{total} figuras renderizadas em {saida}")
