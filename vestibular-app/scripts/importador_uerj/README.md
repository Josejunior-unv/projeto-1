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
hash SHA-256 (manifesto local), arquivos já conhecidos são **reclassificados**
com as regras mais novas a cada execução, e a publicação substitui as
questões de cada prova por completo (nada duplica nem fica obsoleto). Em
execuções completas (sem `--ano`/`--limite`) as provas que deixaram de
pertencer ao acervo (concursos CBMERJ, proficiência etc.) são **removidas**
do banco automaticamente.

## Etapas

| Etapa | Módulo | O que faz |
| --- | --- | --- |
| Crawl | `crawler.py` | BFS no domínio, cataloga PDFs; ano/fase vêm do padrão `/anexos/AAE/`, do NOME do arquivo (`2015_1eq_prova.pdf`) e só então do contexto — nunca da pasta de upload do WordPress (é a data de upload, não a da prova) |
| Download | `baixar.py` | paralelo, retry com backoff, valida `%PDF` + abertura no PyMuPDF, deduplica por SHA-256, reclassifica o manifesto com as regras atuais |
| Extração | `extrair.py` | blocos reordenados por coluna (layout 2-colunas da UERJ), rótulos de margem fundidos, área/idioma lidos do rodapé de cada página, banners "AS QUESTÕES X A Y..." reanexados, alternativas validadas em sequência estrita; PDFs que não imprimem "Vestibular Estadual" (outros certames) são excluídos |
| Classificação | `classificar.py` | idioma da página > disciplina do PDF > palavras-chave ponderadas restritas à ÁREA impressa na página; sem confiança mínima ⇒ "Não Classificada" (com área preservada) |
| Publicação | `publicar.py` | Storage (`materiais/uerj/...`) + upsert de provas por hash + **substituição total** das questões de cada prova + remoção de provas obsoletas + logs em `uerj_import_logs` |

## Regras de correção importantes

- **Questões de língua estrangeira (23–27) nunca recebem gabarito**: cada
  idioma (inglês/espanhol/francês) tem respostas próprias no gabarito e
  atribuir a coluna errada corrigiria o aluno com a resposta de outra
  língua. Elas são importadas (uma versão por idioma), só não têm correção
  automática.
- **Gabaritos retificados** são aplicados por último e prevalecem.
- **Provas 2012 (e outras com numeração vetorial, sem texto)** entram só
  como PDF: numerar "no chute" arriscaria parear gabarito errado.

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
corrigidas na aba **Provas UERJ** do Painel do Admin. Atenção: a publicação
faz **substituição total** das questões de cada prova — reprocessar e
publicar de novo sobrescreve correções manuais feitas no painel (e troca os
IDs das questões, zerando o progresso local dos alunos no banco UERJ).
Prefira evoluir as regras do `classificar.py` e reimportar, usando o painel
só para ajustes pontuais depois da importação final.
