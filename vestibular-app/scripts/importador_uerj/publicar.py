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

    def substituir_questoes(self, prova_id, questoes):
        """Apaga as questões atuais da prova e insere as novas.

        Mais seguro que upsert aqui: correções de extração/classificação
        mudam o CONJUNTO de questões (números que somem, versões por idioma
        que surgem) e o upsert deixaria linhas obsoletas no banco.
        """
        resp = self.sessao.delete(
            f"{self.base}/rest/v1/questoes_uerj?prova_id=eq.{int(prova_id)}",
            timeout=TIMEOUT_HTTP * 3,
        )
        if resp.status_code >= 300:
            raise RuntimeError(
                f"limpeza questoes {resp.status_code}: {resp.text[:300]}"
            )
        salvas = 0
        for i in range(0, len(questoes), 50):  # lotes p/ não estourar o corpo
            lote = questoes[i : i + 50]
            resp = self.sessao.post(
                f"{self.base}/rest/v1/questoes_uerj",
                json=lote,
                headers={
                    "Prefer": "return=minimal",
                    "Content-Type": "application/json",
                },
                timeout=TIMEOUT_HTTP * 3,
            )
            if resp.status_code >= 300:
                raise RuntimeError(
                    f"questoes_uerj {resp.status_code}: {resp.text[:300]}"
                )
            salvas += len(lote)
        return salvas

    def excluir_provas_fora_de(self, hashes_validos):
        """Remove provas cujo hash não está no acervo atual (e suas questões,
        via FK on delete cascade). Devolve quantas foram removidas."""
        remotas, inicio = [], 0
        while True:
            resp = self.sessao.get(
                f"{self.base}/rest/v1/provas_uerj?select=id,hash_sha256"
                f"&order=id&limit=1000&offset={inicio}",
                timeout=TIMEOUT_HTTP,
            )
            resp.raise_for_status()
            pagina = resp.json()
            remotas += pagina
            if len(pagina) < 1000:
                break
            inicio += 1000
        obsoletas = [
            p["id"] for p in remotas if p.get("hash_sha256") not in hashes_validos
        ]
        for i in range(0, len(obsoletas), 50):
            ids = ",".join(str(x) for x in obsoletas[i : i + 50])
            resp = self.sessao.delete(
                f"{self.base}/rest/v1/provas_uerj?id=in.({ids})",
                timeout=TIMEOUT_HTTP * 3,
            )
            if resp.status_code >= 300:
                raise RuntimeError(
                    f"exclusao provas {resp.status_code}: {resp.text[:300]}"
                )
        return len(obsoletas)

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
