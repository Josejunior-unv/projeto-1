"""Configuração central do importador de provas da UERJ.

Tudo que é ajustável (limites, caminhos, credenciais) mora aqui.
As credenciais vêm de variáveis de ambiente — nunca do código.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------- site alvo
BASE_URL = "https://www.vestibular.uerj.br/"
DOMINIOS_PERMITIDOS = {"www.vestibular.uerj.br", "vestibular.uerj.br"}

USER_AGENT = (
    "VestibularAppBot/1.0 (+importador educacional de provas publicas; "
    "contato: admin do Vestibular App)"
)

# Educação com o servidor: pausa entre requisições de página (segundos).
PAUSA_ENTRE_PAGINAS = 0.4
# Profundidade máxima do crawl a partir da home.
PROFUNDIDADE_MAXIMA = 4
# Máximo de páginas HTML visitadas (trava de segurança).
MAX_PAGINAS = 800

# ------------------------------------------------------------- diretórios
RAIZ = Path(__file__).resolve().parent
DIR_DADOS = RAIZ / "dados"
DIR_DOWNLOADS = DIR_DADOS / "downloads"     # PDFs organizados ano/tipo/fase
DIR_IMAGENS = DIR_DADOS / "imagens"         # figuras extraídas das questões
DIR_CACHE = DIR_DADOS / "cache"             # páginas HTML e manifestos
ARQ_MANIFESTO = DIR_CACHE / "manifesto.json"        # hash -> arquivo baixado
ARQ_CATALOGO = DIR_CACHE / "catalogo.json"          # resultado do crawl
ARQ_EXTRACAO = DIR_CACHE / "questoes_extraidas.json"
ARQ_LOG = DIR_DADOS / "importador.log"

# ------------------------------------------------------------- downloads
DOWNLOADS_PARALELOS = 4
TENTATIVAS_DOWNLOAD = 3
TIMEOUT_HTTP = 40  # segundos

# ------------------------------------------------------------- supabase
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://gvdlbfwqjpqpxlxlvbxu.supabase.co"
)
# A service role key IGNORA RLS — use apenas neste pipeline, nunca no app.
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
# Alternativa: e-mail/senha de uma conta ADMIN do app (respeita RLS de admin).
UERJ_ADMIN_EMAIL = os.environ.get("UERJ_ADMIN_EMAIL", "")
UERJ_ADMIN_SENHA = os.environ.get("UERJ_ADMIN_SENHA", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

BUCKET = "materiais"        # mesmo bucket público já usado pelo app
PASTA_BUCKET = "uerj"       # subpasta para tudo do importador


def garantir_diretorios():
    for d in (DIR_DADOS, DIR_DOWNLOADS, DIR_IMAGENS, DIR_CACHE):
        d.mkdir(parents=True, exist_ok=True)
