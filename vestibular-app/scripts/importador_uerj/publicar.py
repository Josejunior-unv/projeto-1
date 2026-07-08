"""Publicação no Supabase do Vestibular App.

Envia PDFs para o Storage (bucket `materiais`, pasta `uerj/`) e insere
provas/questões nas tabelas `provas_uerj` / `questoes_uerj` via PostgREST,
com upsert por chave natural (hash do PDF; prova+numero da questão).
Também grava eventos em `uerj_import_logs` para o Painel do Admin.

Autenticação (uma das duas):
  SUPABASE_SERVICE_ROLE_KEY  -> ignora RLS (recomendado para o pipeline);
  UERJ_ADMIN_EMAIL/SENHA + SUPABASE_ANON_KEY -> login como admin do app.
"""

import logging
import mimetypes
from pathlib import Path

import requests

from config import (
    BUCKET,
    PASTA_BUCKET,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY,
    SUPABASE_URL,
    TIMEOUT_HTTP,
    UERJ_ADMIN_EMAIL,
    UERJ_ADMIN_SENHA,
)

log = logging.getLogger("publicar")


class Publicador:
    def __init__(self):
        self.base = SUPABASE_URL.rstrip("/")
        self.sessao = requests.Session()
        self._autenticar()

    # ------------------------------------------------------------- auth
    def _autenticar(self):
        if SUPABASE_SERVICE_KEY:
            apikey = SUPABASE_SERVICE_KEY
            token = SUPABASE_SERVICE_KEY
            log.info("Autenticado com service role key (ignora RLS).")
        elif UERJ_ADMIN_EMAIL and UERJ_ADMIN_SENHA and SUPABASE_ANON_KEY:
            resp = requests.post(
                f"{self.base}/auth/v1/token?grant_type=password",
                json={"email": UERJ_ADMIN_EMAIL, "password": UERJ_ADMIN_SENHA},
                headers={"apikey": SUPABASE_ANON_KEY},
                timeout=TIMEOUT_HTTP,
            )
            resp.raise_for_status()
            apikey = SUPABASE_ANON_KEY
            token = resp.json()["access_token"]
            log.info("Autenticado como admin: %s", UERJ_ADMIN_EMAIL)
        else:
            raise SystemExit(
                "Defina SUPABASE_SERVICE_ROLE_KEY ou "
                "UERJ_ADMIN_EMAIL + UERJ_ADMIN_SENHA + SUPABASE_ANON_KEY."
            )
        self.sessao.headers.update(
            {"apikey": apikey, "Authorization": f"Bearer {token}"}
        )

    # ---------------------------------------------------------- storage
    def enviar_arquivo(self, caminho_local, destino_relativo):
        """Sobe um arquivo para o bucket público. Devolve a URL pública."""
        caminho_local = Path(caminho_local)
        objeto = f"{PASTA_BUCKET}/{destino_relativo}".replace("\\", "/")
        tipo = mimetypes.guess_type(caminho_local.name)[0] or "application/octet-stream"
        resp = self.sessao.post(
            f"{self.base}/storage/v1/object/{BUCKET}/{objeto}",
            data=caminho_local.read_bytes(),
            headers={"Content-Type": tipo, "x-upsert": "true"},
            timeout=TIMEOUT_HTTP * 3,
        )
        if resp.status_code >= 300:
            raise RuntimeError(f"Storage {resp.status_code}: {resp.text[:200]}")
        return f"{self.base}/storage/v1/object/public/{BUCKET}/{objeto}"

    # ------------------------------------------------------------- rest
    def _upsert(self, tabela, linhas, on_conflict):
        if not linhas:
            return []
        resp = self.sessao.post(
            f"{self.base}/rest/v1/{tabela}?on_conflict={on_conflict}",
            json=linhas,
            headers={
                "Prefer": "resolution=merge-duplicates,return=representation",
                "Content-Type": "application/json",
            },
            timeout=TIMEOUT_HTTP * 3,
        )
        if resp.status_code >= 300:
            raise RuntimeError(f"{tabela} {resp.status_code}: {resp.text[:300]}")
        return resp.json()

    def upsert_prova(self, prova):
        return self._upsert("provas_uerj", [prova], "hash_sha256")[0]

    def upsert_questoes(self, questoes):
        # Em lotes de 50 para não estourar o corpo da requisição.
        salvas = 0
        for i in range(0, len(questoes), 50):
            salvas += len(
                self._upsert("questoes_uerj", questoes[i : i + 50], "prova_id,numero")
            )
        return salvas

    def registrar_log(self, nivel, evento, detalhes=None):
        try:
            self.sessao.post(
                f"{self.base}/rest/v1/uerj_import_logs",
                json={"nivel": nivel, "evento": evento, "detalhes": detalhes or {}},
                headers={"Content-Type": "application/json"},
                timeout=TIMEOUT_HTTP,
            )
        except requests.RequestException as erro:
            log.warning("Log remoto falhou (%s) — seguindo.", erro)
