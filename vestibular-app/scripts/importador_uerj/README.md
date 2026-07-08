# Importador de Provas da UERJ

Pipeline que rastreia o portal público da UERJ (vestibular.uerj.br), baixa
todas as provas em PDF, extrai as questões e publica tudo no Supabase do
Vestibular App — onde aparecem automaticamente na **Biblioteca UERJ**, no
hub de **Questões** e na aba **Provas UERJ** do Painel do Admin.

## Pré-requisitos

1. **Rodar a migração** (uma vez): abra o Supabase → SQL Editor e execute o
   `supabase_migration.sql` da raiz do projeto (a parte 7 cria as tabelas
   `provas_uerj`, `questoes_uerj` e `uerj_import_logs`).
2. **Python 3.10+** com as dependências:

   ```bash
   cd scripts/importador_uerj
   pip install -r requirements.txt
   ```

3. **Credenciais** (uma das opções):

   ```powershell
   # Opção A — service role key (Supabase > Settings > API). Recomendada.
   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."

   # Opção B — conta admin do app (respeita a RLS de admin)
   $env:UERJ_ADMIN_EMAIL = "admin@exemplo.com"
   $env:UERJ_ADMIN_SENHA = "..."
   $env:SUPABASE_ANON_KEY = "eyJ..."   # a mesma publishable key do app
   ```

   > A service role key **ignora RLS** — use só aqui, nunca no frontend.

## Uso

```bash
python main.py                      # pipeline completo (crawl -> publicar)
python main.py --sem-publicar       # dry-run: só gera JSONs locais
python main.py --sem-crawl          # reusa o catálogo da última execução
python main.py --ano 2024           # apenas uma edição
python main.py --limite 5           # no máx. 5 PDFs de prova (teste)
python main.py --max-paginas 60     # crawl curto (teste)
```

O pipeline é **idempotente e incremental**: PDFs já baixados são pulados via
hash SHA-256 (manifesto local) e a publicação faz upsert (nada duplica).
Rode de novo a qualquer momento para importar edições novas — o crawler
descobre anos automaticamente, sem listas fixas.

## Etapas

| Etapa | Módulo | O que faz |
| --- | --- | --- |
| Crawl | `crawler.py` | BFS no domínio, cataloga PDFs e deduz ano/tipo/fase/disciplina do contexto do link |
| Download | `baixar.py` | paralelo, retry com backoff, valida `%PDF` + abertura no PyMuPDF, deduplica por SHA-256, organiza em `dados/downloads/<ano>/<tipo>/<fase>/` |
| Extração | `extrair.py` | PyMuPDF → pdfplumber → OCR (opcional); segmenta `QUESTÃO NN`, separa alternativas `(A)...(D)`, exporta figuras, casa gabaritos |
| Classificação | `classificar.py` | disciplina/assunto por palavras-chave, dificuldade estimada, habilidades; sem match ⇒ "Não Classificada" |
| Publicação | `publicar.py` | Storage (`materiais/uerj/...`) + upsert em `provas_uerj`/`questoes_uerj` + logs em `uerj_import_logs` |

## Saídas locais

- `dados/downloads/` — PDFs organizados
- `dados/imagens/` — figuras extraídas das questões
- `dados/cache/catalogo.json` — resultado do crawl
- `dados/cache/questoes_extraidas.json` — extração completa (auditável)
- `dados/importador.log` — log detalhado de tudo

## OCR (provas escaneadas)

Edições muito antigas podem ser digitalizações sem camada de texto. Para
essas, instale o [Tesseract-OCR](https://github.com/tesseract-ocr/tesseract)
com o idioma `por` e descomente `pytesseract`/`Pillow` no requirements.
Sem OCR o pipeline apenas registra o aviso e segue.

## Correções manuais

Classificações erradas e questões com extração imperfeita podem ser
corrigidas na aba **Provas UERJ** do Painel do Admin — o pipeline nunca
sobrescreve uma correção manual em execuções futuras, desde que o conteúdo
do PDF não mude (o upsert é por `prova_id + numero`; campos editados no
painel são atualizados apenas se você reprocessar o PDF).
