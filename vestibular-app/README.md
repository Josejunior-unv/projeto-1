# Pré-Vestibular UERJ Para Todos

Plataforma educacional para alunos de pré-vestibular: cronograma personalizado,
banco de questões (ENEM oficial + acervo completo da UERJ), simulados, provas
para resolver online, biblioteca de PDFs, tarefas por matéria e estatísticas
automáticas de desempenho.

**Produção:** https://vest-app-nine.vercel.app

## Stack

- **Frontend:** React 19 + Vite 8 + Tailwind CSS v4 (tokens no `@theme` de
  `src/index.css`), framer-motion, recharts, lucide-react, react-router.
- **Backend:** Supabase (Auth + Postgres com RLS + Storage). Cliente em
  `src/SUPABASE.js` — a chave anon/publishable é pública por design; a
  segurança real é feita pelas políticas de RLS (`supabase_migration.sql`).
- **Questões ENEM:** API pública `api.enem.dev`.
- **Questões UERJ:** pipeline offline em Python (`scripts/importador_uerj/`)
  que baixa, extrai, classifica e publica as provas oficiais no Supabase.

## Como rodar

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

Antes de commitar:

```bash
npm run lint && npm run build
```

## Banco de dados

Todo o schema + políticas de segurança moram em **`supabase_migration.sql`**
(idempotente — rode o arquivo INTEIRO no SQL Editor do Supabase; rodar só um
trecho deixa políticas antigas ativas). Partes principais:

| Parte | O quê |
| --- | --- |
| 1–5 | materiais, tarefas, notícias, cronogramas, questões respondidas |
| 6 | RPCs de admin (`admin_listar_usuarios`, `admin_definir_cargo`) |
| 7–8 | acervo UERJ (`provas_uerj`, `questoes_uerj`, `uerj_import_logs`) |
| 9 | revisão de RLS (escrita de materiais/storage só admin, etc.) |
| 10 | correções de dados do acervo (auditoria 08/07/2026) |

## Cargos

O cadastro cria sempre `aluno`. A promoção para `admin` é feita pela aba
**👥 Usuários** do Painel do Admin (RPCs SECURITY DEFINER — um admin não
consegue rebaixar a si mesmo).

## Importador de provas da UERJ

```bash
cd scripts/importador_uerj
pip install -r requirements.txt
set SUPABASE_SERVICE_ROLE_KEY=...   # nunca commitar essa chave
python main.py
```

Detalhes (heurísticas de ano/fase, extração de 2 colunas, gabaritos,
idiomas 23–27) no `scripts/importador_uerj/README.md`. Regras importantes:
questões de língua estrangeira **nunca** recebem gabarito (cada idioma tem
coluna própria no gabarito oficial) e o ano **nunca** vem da pasta de upload
do WordPress.

## Deploy

- Vercel, deploy automático a cada push no `master` do repositório
  `Josejunior-unv/projeto-1` (Root Directory = `vestibular-app`).
- `vercel.json` cuida do fallback de SPA e dos headers de segurança
  (CSP restrita, HSTS, nosniff, X-Frame-Options DENY...). Ao consumir uma
  API nova, inclua o domínio no `connect-src` da CSP.
- O deploy roda em Linux: **imports são case-sensitive** — o build quebra em
  produção se a caixa do nome do arquivo não bater.

## Auditoria de 08/07/2026 — correções

- **Sistema de respostas:** a página de questão do banco UERJ era renderizada
  sem `key`; ao navegar, a resposta/tempo da questão anterior "vazava" para a
  seguinte, que aparecia já respondida com a letra errada. Corrigido com
  remount por questão (`key={questao.id}`) em `BancoQuestoesUerj.jsx`.
- **Filtros:** abrir uma pasta de matéria (ou atalho "Erradas"/"Favoritas")
  misturava os filtros salvos da sessão anterior (assunto/área/ano de outra
  matéria), produzindo combinações impossíveis com 0 resultados. Agora
  filtros iniciais partem do padrão.
- **Dados:** 11 questões de língua estrangeira estavam com gabarito (risco de
  corrigir o aluno com a resposta de outro idioma) e ~240 questões tinham a
  coluna `area` ausente ou na forma combinada antiga — parte 10 da migration
  limpa o legado, e o pipeline (`main.py`/`classificar.py`) foi corrigido na
  causa raiz para não reintroduzir.
- **UX:** questões cujo enunciado/alternativa não pôde ser extraído do PDF
  agora avisam e apontam para a prova original em vez de mostrar um card mudo.
- **Console limpo:** `App.jsx` usa `maybeSingle()` para perfis/cronogramas
  inexistentes (novos alunos geravam 406 no console).
- **Validação:** suíte E2E com Playwright (cadastro → onboarding → banco UERJ
  → resposta → navegação → filtros individuais e combinados → status →
  regressão da pasta) — 15/15 verdes, sem erros de console; lint e build limpos.
