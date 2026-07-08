"""Classificação heurística das questões extraídas.

Atribui disciplina, assunto, subassunto, dificuldade e habilidades a
partir de palavras-chave do enunciado. Quando nada casa, a questão fica
"Não Classificada" — e pode ser corrigida depois pela aba Provas UERJ do
Painel do Admin.
"""

import re
import unicodedata

# disciplina -> { assunto -> [palavras-chave sem acento] }
MAPA = {
    "Matemática": {
        "Funções": ["funcao", "f(x)", "dominio", "imagem da funcao", "afim", "quadratica"],
        "Geometria": ["triangulo", "circunferencia", "poligono", "area", "volume", "angulo", "prisma", "piramide"],
        "Probabilidade e Estatística": ["probabilidade", "media aritmetica", "mediana", "estatistica", "combinacao", "permutacao"],
        "Álgebra": ["equacao", "inequacao", "polinomio", "matriz", "logaritmo", "progressao", "sistema linear"],
        "Trigonometria": ["seno", "cosseno", "tangente", "trigonometr"],
    },
    "Física": {
        "Mecânica": ["velocidade", "aceleracao", "forca", "newton", "atrito", "queda livre", "energia cinetica", "movimento"],
        "Eletricidade": ["circuito", "resistor", "corrente eletrica", "tensao", "campo eletrico", "carga eletrica"],
        "Termologia": ["temperatura", "calor", "dilatacao", "termodinamica", "gas ideal"],
        "Óptica e Ondas": ["luz", "lente", "espelho", "refracao", "onda", "frequencia", "som"],
    },
    "Química": {
        "Química Geral": ["atomo", "tabela periodica", "ligacao quimica", "mol ", "massa molar", "eletron"],
        "Físico-Química": ["equilibrio quimico", "ph", "termoquimica", "cinetica", "eletroquimica", "pilha", "solucao"],
        "Química Orgânica": ["carbono", "hidrocarboneto", "organica", "polimero", "alcool", "ester", "isomeria"],
        "Estequiometria": ["estequiometr", "reagente", "rendimento", "balanceamento"],
    },
    "Biologia": {
        "Citologia e Genética": ["celula", "dna", "rna", "gene", "cromossomo", "mitose", "meiose", "hereditar"],
        "Fisiologia": ["hormonio", "sistema nervoso", "digestao", "respiracao celular", "circulat", "imunol"],
        "Ecologia": ["ecossistema", "cadeia alimentar", "bioma", "populacao", "meio ambiente", "fotossintese"],
        "Evolução e Microbiologia": ["evolucao", "selecao natural", "bacteria", "virus", "fungo", "protozoario"],
    },
    "História": {
        "História do Brasil": ["brasil colonia", "imperio", "republica", "getulio", "vargas", "ditadura", "escravidao", "abolicao"],
        "História Geral": ["revolucao francesa", "guerra mundial", "idade media", "feudalismo", "iluminismo", "guerra fria", "imperialismo"],
    },
    "Geografia": {
        "Geografia Física": ["clima", "relevo", "bacia hidrografica", "vegetacao", "placa tectonica", "erosao"],
        "Geografia Humana": ["urbanizacao", "migracao", "demografia", "globalizacao", "industrializacao", "agropecuaria"],
        "Geopolítica": ["geopolitic", "fronteira", "bloco economico", "conflito"],
    },
    "Português": {
        "Interpretação de Texto": ["texto", "cronica", "narrador", "autor", "leitor", "poema", "verso"],
        "Gramática": ["oracao", "sujeito", "verbo", "pronome", "concordancia", "regencia", "crase", "morfolog"],
        "Literatura": ["romantismo", "modernismo", "realismo", "barroco", "machado de assis", "literari"],
    },
    "Inglês": {
        "Reading": ["according to the text", "the author", "the passage", "in the text"],
    },
    "Espanhol": {
        "Lectura": ["segun el texto", "el autor", "en el texto"],
    },
    "Filosofia": {
        "Filosofia": ["filosof", "etica", "platao", "aristoteles", "kant", "razao"],
    },
    "Sociologia": {
        "Sociologia": ["sociolog", "sociedade", "durkheim", "weber", "marx", "cidadania"],
    },
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


def classificar(questao, disciplina_sugerida=None):
    """Devolve os campos de classificação para uma questão extraída."""
    alvo = _sem_acento(
        questao.get("enunciado", "")
        + " "
        + " ".join(a.get("texto", "") for a in questao.get("alternativas", []))
    )

    melhor = (0, None, None)  # (pontos, disciplina, assunto)
    for disciplina, assuntos in MAPA.items():
        for assunto, palavras in assuntos.items():
            pontos = sum(1 for p in palavras if p in alvo)
            if pontos > melhor[0]:
                melhor = (pontos, disciplina, assunto)

    pontos, disciplina, assunto = melhor
    classificada = pontos >= 1

    # A disciplina do próprio PDF (prova discursiva de Física, p.ex.) tem
    # prioridade sobre o palpite por palavras-chave.
    if disciplina_sugerida:
        disciplina = disciplina_sugerida
        classificada = True
        if pontos == 0:
            assunto = None

    habilidades = [
        nome for nome, palavras in HABILIDADES.items()
        if any(p in alvo for p in palavras)
    ]

    return {
        "disciplina": disciplina if classificada else "Não Classificada",
        "assunto": (assunto or "Não Classificado") if classificada else "Não Classificado",
        "subassunto": None,
        "dificuldade": _dificuldade(questao),
        "habilidades": habilidades,
        "classificada": classificada,
    }


# Padrão usado pelo pipeline p/ ligar gabaritos a provas: mesma edição.
def chave_prova(item):
    return (item.get("ano"), item.get("fase") or "geral")


RE_LIMPA = re.compile(r"\s+")
