"""Classificação das questões extraídas.

Ordem de prioridade dos sinais (do mais confiável ao menos):
1. IDIOMA da página (rodapé "Linguagens  Espanhol") → Inglês/Espanhol/Francês.
2. DISCIPLINA do próprio PDF (prova discursiva de Física, p.ex.).
3. ÁREA da página (rodapé "Ciências Humanas" etc.) restringindo as
   disciplinas candidatas + palavras-chave PONDERADAS do enunciado.

Quando nada casa, a questão fica "Não Classificada" — e pode ser corrigida
depois pela aba Provas UERJ do Painel do Admin.
"""

import re
import unicodedata

# disciplina -> { assunto -> [(palavra sem acento, peso)] }
# Pesos: 3 = praticamente exclusivo da disciplina; 2 = forte; 1 = indício.
MAPA = {
    "Matemática": {
        "Funções": [("funcao", 2), ("f(x)", 3), ("dominio da funcao", 3),
                    ("funcao afim", 3), ("quadratica", 2), ("grafico da funcao", 3)],
        "Geometria": [("triangulo", 2), ("circunferencia", 2), ("poligono", 3),
                      ("hipotenusa", 3), ("vertice", 2), ("prisma", 3),
                      ("piramide", 2), ("cilindro", 2), ("aresta", 3),
                      ("perimetro", 3), ("angulo", 1), ("cubo", 2)],
        "Probabilidade e Estatística": [("probabilidade", 3), ("media aritmetica", 3),
                                        ("mediana", 3), ("combinacao", 1),
                                        ("permutacao", 3), ("anagrama", 3),
                                        ("aleatori", 2), ("sorteio", 2), ("dado e lancado", 3)],
        "Álgebra": [("equacao", 2), ("inequacao", 3), ("polinomio", 3),
                    ("matriz", 2), ("logaritmo", 3), ("progressao aritmetica", 3),
                    ("progressao geometrica", 3), ("sistema linear", 3),
                    ("numero inteiro", 2), ("algarismo", 2), ("divisor", 2), ("multiplo de", 2)],
        "Trigonometria": [("seno", 3), ("cosseno", 3), ("tangente", 2), ("trigonometr", 3)],
    },
    "Física": {
        "Mecânica": [("velocidade media", 2), ("aceleracao", 2), ("newton", 3),
                     ("atrito", 2), ("queda livre", 3), ("energia cinetica", 3),
                     ("energia potencial", 3), ("quantidade de movimento", 3),
                     ("gravitacional", 2), ("m/s", 2), ("km/h", 1), ("trajetoria", 2)],
        "Eletricidade": [("circuito", 2), ("resistor", 3), ("corrente eletrica", 3),
                         ("tensao eletrica", 3), ("campo eletrico", 3),
                         ("carga eletrica", 3), ("volt", 2), ("ampere", 3),
                         ("potencia eletrica", 3), ("ohm", 3), ("capacitor", 3)],
        "Termologia": [("temperatura", 1), ("calor especifico", 3), ("dilatacao", 2),
                       ("termodinamica", 3), ("gas ideal", 3), ("celsius", 2),
                       ("kelvin", 3), ("caloria", 2), ("equilibrio termico", 3)],
        "Óptica e Ondas": [("lente", 2), ("espelho", 2), ("refracao", 3),
                           ("reflexao", 2), ("comprimento de onda", 3),
                           ("frequencia", 1), ("hertz", 3), ("ondas sonoras", 3),
                           ("raio de luz", 3), ("indice de refracao", 3)],
    },
    "Química": {
        "Química Geral": [("tabela periodica", 3), ("ligacao quimica", 3),
                          ("massa molar", 3), ("eletron", 2), ("proton", 2),
                          ("atomico", 2), ("molecula", 2), ("elemento quimico", 3),
                          ("ligacao covalente", 3), ("ionica", 2), ("isotopo", 3)],
        "Físico-Química": [("equilibrio quimico", 3), ("termoquimica", 3),
                           ("cinetica quimica", 3), ("eletroquimica", 3),
                           ("pilha", 2), ("oxidacao", 2), ("reducao", 1),
                           ("concentracao da solucao", 3), ("mol/l", 3), ("ph ", 2)],
        "Química Orgânica": [("hidrocarboneto", 3), ("organica", 2), ("polimero", 2),
                             ("cadeia carbonica", 3), ("ester", 2), ("isomeria", 3),
                             ("etanol", 2), ("benzeno", 3), ("grupo funcional", 3)],
        "Estequiometria": [("estequiometr", 3), ("reagente", 2), ("rendimento da reacao", 3),
                           ("balanceamento", 3), ("equacao quimica", 3), ("mol de", 2)],
    },
    "Biologia": {
        "Citologia e Genética": [("celula", 2), ("dna", 2), ("rna", 2), ("gene", 2),
                                 ("cromossomo", 3), ("mitose", 3), ("meiose", 3),
                                 ("hereditar", 3), ("genotipo", 3), ("fenotipo", 3),
                                 ("proteina", 2), ("enzima", 2), ("mitocondria", 3),
                                 ("membrana plasmatica", 3), ("organela", 3)],
        "Fisiologia": [("hormonio", 3), ("sistema nervoso", 3), ("digestao", 2),
                       ("respiracao celular", 3), ("circulat", 2), ("imunol", 3),
                       ("neuronio", 3), ("insulina", 3), ("hemoglobina", 3),
                       ("rim", 1), ("figado", 2), ("pulmao", 2), ("anticorpo", 3)],
        "Ecologia": [("ecossistema", 3), ("cadeia alimentar", 3), ("bioma", 3),
                     ("fotossintese", 3), ("teia alimentar", 3), ("nicho ecologico", 3),
                     ("biodiversidade", 2), ("predador", 2), ("especie", 1)],
        "Evolução e Microbiologia": [("evolucao", 1), ("selecao natural", 3),
                                     ("bacteria", 2), ("virus", 2), ("fungo", 2),
                                     ("protozoario", 3), ("darwin", 3), ("parasita", 2),
                                     ("mosquito", 2), ("infeccao", 2), ("vacina", 2)],
    },
    "História": {
        "História do Brasil": [("brasil colonia", 3), ("periodo imperial", 3),
                               ("proclamacao da republica", 3), ("getulio", 3),
                               ("vargas", 3), ("ditadura", 2), ("escravidao", 2),
                               ("abolicao", 3), ("capitania", 3), ("bandeirante", 3),
                               ("independencia do brasil", 3), ("estado novo", 3),
                               ("regime militar", 3), ("dom pedro", 3)],
        "História Geral": [("revolucao francesa", 3), ("guerra mundial", 3),
                           ("idade media", 3), ("feudalismo", 3), ("iluminismo", 3),
                           ("guerra fria", 3), ("imperialismo", 2), ("nazismo", 3),
                           ("revolucao industrial", 3), ("absolutismo", 3),
                           ("colonizacao", 2), ("renascimento", 2), ("reforma protestante", 3)],
    },
    "Geografia": {
        "Geografia Física": [("clima", 2), ("relevo", 3), ("bacia hidrografica", 3),
                             ("vegetacao", 2), ("placa tectonica", 3), ("erosao", 3),
                             ("desmatamento", 2), ("chuva", 1), ("solo", 1)],
        "Geografia Humana": [("urbanizacao", 3), ("migracao", 2), ("demografi", 3),
                             ("globalizacao", 2), ("industrializacao", 2),
                             ("agropecuaria", 3), ("populacao urbana", 3),
                             ("metropole", 3), ("favela", 2), ("territorio", 1)],
        "Geopolítica": [("geopolitic", 3), ("fronteira", 2), ("bloco economico", 3),
                        ("mercosul", 3), ("onu", 2), ("comercio internacional", 3)],
    },
    "Português": {
        "Interpretação de Texto": [("cronica", 2), ("narrador", 3), ("poema", 2),
                                   ("verso", 2), ("estrofe", 3), ("personagem", 2),
                                   ("cartum", 2), ("efeito de sentido", 3),
                                   ("figura de linguagem", 3), ("metafora", 3),
                                   ("ironia", 2), ("no fragmento", 2), ("no trecho", 2),
                                   ("do texto", 1), ("o autor", 1), ("eu lirico", 3)],
        "Gramática": [("oracao", 3), ("sujeito", 2), ("verbo", 2), ("pronome", 3),
                      ("concordancia", 3), ("regencia", 3), ("crase", 3),
                      ("morfolog", 3), ("adjetivo", 2), ("substantivo", 2),
                      ("preposicao", 3), ("conjuncao", 2), ("adverbio", 3),
                      ("pontuacao", 2), ("virgula", 2)],
        "Literatura": [("romantismo", 3), ("modernismo", 3), ("realismo", 2),
                       ("barroco", 3), ("machado de assis", 3), ("literari", 2),
                       ("drummond", 3), ("naturalismo", 3), ("parnasian", 3),
                       ("arcadismo", 3), ("romance", 1), ("conto", 1)],
    },
    "Inglês": {
        "Leitura e Interpretação": [("according to the text", 3), ("the author", 2),
                                    ("the passage", 3), ("in the text", 3),
                                    (" the ", 1), (" and ", 1), (" of the ", 2)],
    },
    "Espanhol": {
        "Leitura e Interpretação": [("segun el texto", 3), ("el autor", 2),
                                    ("en el texto", 3), (" el ", 1), (" una ", 1)],
    },
    "Francês": {
        "Leitura e Interpretação": [("selon le texte", 3), ("l'auteur", 2),
                                    ("dans le texte", 3), (" le ", 1), (" une ", 1)],
    },
    "Filosofia": {
        "Filosofia": [("filosof", 3), ("etica", 2), ("platao", 3), ("aristoteles", 3),
                      ("kant", 3), ("socrates", 3), ("nietzsche", 3), ("descartes", 3),
                      ("metafisica", 3), ("epistemolog", 3), ("razao", 1)],
    },
    "Sociologia": {
        "Sociologia": [("sociolog", 3), ("durkheim", 3), ("weber", 3), ("marx", 3),
                       ("cidadania", 2), ("classe social", 3), ("desigualdade social", 3),
                       ("movimento social", 3), ("capitalismo", 2)],
    },
}

# Rodapé da página -> disciplinas candidatas. Restringe o palpite por
# palavras-chave ao que a própria prova diz que a seção contém.
DISCIPLINAS_POR_AREA = {
    "Linguagens": ["Português", "Inglês", "Espanhol", "Francês"],
    "Matemática": ["Matemática"],
    "Ciências da Natureza": ["Biologia", "Física", "Química"],
    "Ciências Humanas": ["História", "Geografia", "Filosofia", "Sociologia"],
    "Ciências da Natureza e Matemática": ["Matemática", "Biologia", "Física", "Química"],
}

# Sem palavras-chave, a área ainda define um palpite seguro quando ela
# só tem uma disciplina possível no vestibular da UERJ.
PADRAO_DA_AREA = {
    "Linguagens": ("Português", "Interpretação de Texto"),
    "Matemática": ("Matemática", None),
}

HABILIDADES = {
    "interpretacao": ["texto", "grafico", "tabela", "figura", "leia", "observe"],
    "calculo": ["calcule", "determine o valor", "quantos", "razao entre"],
    "analise": ["analise", "compare", "relacione", "explique", "justifique"],
}


def _sem_acento(texto):
    return (
        unicodedata.normalize("NFD", texto or "")
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )


def _dificuldade(questao):
    """Mesma heurística das questões do ENEM no app: comprimento + imagens."""
    tamanho = len(questao.get("enunciado", "")) + sum(
        len(a.get("texto", "")) for a in questao.get("alternativas", [])
    )
    if questao.get("imagens"):
        tamanho += 250
    if tamanho < 750:
        return "facil"
    if tamanho < 1100:
        return "media"
    return "dificil"


def _melhor_por_palavras(alvo, candidatas):
    melhor = (0, None, None)  # (pontos, disciplina, assunto)
    for disciplina in candidatas:
        for assunto, palavras in MAPA.get(disciplina, {}).items():
            pontos = sum(peso for palavra, peso in palavras if palavra in alvo)
            if pontos > melhor[0]:
                melhor = (pontos, disciplina, assunto)
    return melhor


def classificar(questao, disciplina_sugerida=None):
    """Devolve os campos de classificação para uma questão extraída."""
    alvo = _sem_acento(
        questao.get("enunciado", "")
        + " "
        + " ".join(a.get("texto", "") for a in questao.get("alternativas", []))
    )
    area = questao.get("area")
    idioma = questao.get("idioma")

    # 1) Página de língua estrangeira: a disciplina é o idioma.
    if idioma:
        habilidades = _habilidades(alvo)
        return {
            "disciplina": idioma,
            "assunto": "Leitura e Interpretação",
            "subassunto": None,
            "area": "Linguagens",
            "dificuldade": _dificuldade(questao),
            "habilidades": habilidades,
            "classificada": True,
        }

    # 2) Prova discursiva por matéria: o PDF já diz a disciplina.
    if disciplina_sugerida:
        pontos, _, assunto = _melhor_por_palavras(alvo, [disciplina_sugerida])
        return {
            "disciplina": disciplina_sugerida,
            "assunto": (assunto if pontos >= 2 else None) or "Não Classificado",
            "subassunto": None,
            "area": _area_da_disciplina(disciplina_sugerida),
            "dificuldade": _dificuldade(questao),
            "habilidades": _habilidades(alvo),
            "classificada": True,
        }

    # 3) Palavras-chave, restritas à área impressa na página.
    # SEM área de rodapé (e sem disciplina sugerida da prova), NÃO se chuta
    # entre todas as disciplinas: um acerto fraco de palavra-chave jogava
    # textos em espanhol para "Matemática". Melhor deixar "Não Classificada"
    # (o admin corrige na aba Provas UERJ) do que rotular errado.
    candidatas = DISCIPLINAS_POR_AREA.get(area)
    if not candidatas:
        return {
            "disciplina": "Não Classificada",
            "assunto": "Não Classificado",
            "subassunto": None,
            "area": area,
            "dificuldade": _dificuldade(questao),
            "habilidades": _habilidades(alvo),
            "classificada": False,
        }
    pontos, disciplina, assunto = _melhor_por_palavras(alvo, candidatas)

    # Exige confiança mínima: 1 palavra fraca não classifica sozinha,
    # a não ser que a área só tenha uma disciplina possível.
    minimo = 2 if len(candidatas) > 1 else 1
    classificada = pontos >= minimo

    if not classificada and area in PADRAO_DA_AREA:
        disciplina, assunto = PADRAO_DA_AREA[area]
        classificada = True

    return {
        "disciplina": disciplina if classificada else "Não Classificada",
        "assunto": (assunto or "Não Classificado") if classificada else "Não Classificado",
        "subassunto": None,
        # Com disciplina conhecida, a área canônica vem dela — o rodapé pode
        # trazer a forma combinada ("Ciências da Natureza e Matemática") ou
        # estar ausente em PDFs antigos.
        "area": (_area_da_disciplina(disciplina) if classificada else None) or area,
        "dificuldade": _dificuldade(questao),
        "habilidades": _habilidades(alvo),
        "classificada": classificada,
    }


def _habilidades(alvo):
    return [
        nome for nome, palavras in HABILIDADES.items()
        if any(p in alvo for p in palavras)
    ]


def _area_da_disciplina(disciplina):
    for area, disciplinas in DISCIPLINAS_POR_AREA.items():
        if area == "Ciências da Natureza e Matemática":
            continue
        if disciplina in disciplinas:
            return area
    return None


# Padrão usado pelo pipeline p/ ligar gabaritos a provas: mesma edição.
def chave_prova(item):
    return (item.get("ano"), item.get("fase") or "geral")


RE_LIMPA = re.compile(r"\s+")
