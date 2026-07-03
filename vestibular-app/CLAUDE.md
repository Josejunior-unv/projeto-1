# CLAUDE.md

# Vestibular App

## Objetivo

Transformar este projeto em uma plataforma educacional moderna, escalável e pronta para produção.

O objetivo é criar uma experiência semelhante às principais plataformas de ensino online, mantendo o código limpo, organizado e altamente reutilizável.

---

# Arquitetura

Durante todo o desenvolvimento:

- Priorizar componentização.
- Evitar duplicação de código.
- Criar hooks personalizados quando necessário.
- Criar componentes reutilizáveis.
- Criar serviços separados.
- Melhorar continuamente a arquitetura.
- Não quebrar funcionalidades existentes.

Você possui liberdade para reorganizar o projeto sempre que isso resultar em uma arquitetura melhor.

---

# Design

O projeto deve seguir uma identidade moderna.

Referências:

- Notion
- Duolingo
- Linear
- GitHub
- Stripe
- Google Drive

Utilizar:

- animações suaves;
- microinterações;
- hover elegante;
- skeleton loading;
- sombras discretas;
- gradientes leves;
- excelente responsividade.

---

# Funcionalidades implementadas e definidas

## Questões ENEM

Planejamento:

- filtro por matéria;
- filtro por dificuldade;
- contador de acertos;
- contador de erros;
- estatísticas automáticas;
- progresso salvo;
- navegação entre questões por setas;
- indicador da questão atual;
- revisão de respostas.

---

## Estatísticas

Salvar:

- acertos;
- erros;
- percentual;
- desempenho por matéria;
- tarefas concluídas;
- evolução.

Persistência utilizando banco de dados ou LocalStorage conforme arquitetura.

---

## Área do Professor

Cada matéria possui sua própria organização.

O professor poderá publicar:

- PDFs;
- Links;
- Vídeos;
- Exercícios;
- Avisos;
- Tarefas.

Os PDFs devem utilizar Supabase Storage.

---

## Minhas Tarefas

O aluno visualiza inicialmente apenas pastas das matérias.

Cada pasta apresenta:

- nome;
- progresso;
- quantidade de tarefas;
- última atualização.

Ao abrir uma matéria:

- lista de materiais;
- PDF;
- links;
- vídeos;
- tarefas.

Cada item possui um checkbox independente.

O progresso deve ser salvo individualmente para cada aluno.

---

## Notícias

Existe um painel administrativo para publicação de notícias.

O administrador poderá:

- criar;
- editar;
- excluir;
- destacar;
- ocultar.

As notícias aparecem na página inicial dos alunos em destaque.

---

## Navegação

O sistema deve lembrar automaticamente:

- página atual;
- aba atual;
- matéria aberta;
- filtros;
- posição de navegação.

O usuário nunca deve perder o contexto ao trocar de aba, minimizar ou atualizar o navegador.

---

## Performance

Sempre procurar:

- código duplicado;
- renders desnecessários;
- imports sem uso;
- componentes grandes;
- estados mal organizados.

Implementar melhorias sempre que possível.

---

# Filosofia

Sempre que existir uma solução melhor:

Implemente.

Não espere autorização.

Atue como um Engenheiro de Software Principal responsável pelo produto.

Priorize:

- qualidade;
- escalabilidade;
- organização;
- experiência do usuário;
- facilidade de manutenção.

Sempre preserve funcionalidades existentes antes de adicionar novas.

---

# Estado atual do projeto (contexto para novas sessões)

> Seção de referência viva. Atualize quando algo estrutural mudar.

## Stack
- **React 19 + Vite 8 + Tailwind v4** (config em `@import "tailwindcss"` no `index.css`).
- **framer-motion** (animações), **recharts** (gráficos).
- **Supabase** (auth + Postgres + Storage) em `src/SUPABASE.js` (credenciais via env `VITE_SUPABASE_*` com fallback embutido; a anon/publishable key é pública por design — segurança real = RLS).
- Roteamento: **react-router** por abas em `/app/:aba`.

## Deploy
- **Produção:** https://vest-app-nine.vercel.app (Vercel, deploy automático a cada `git push` no `master`).
- **Repositório:** GitHub `Josejunior-unv/projeto-1`. A app fica na subpasta **`vestibular-app/`** → na Vercel o **Root Directory = `vestibular-app`**.
- `vercel.json` faz o **fallback de SPA** (toda rota → `index.html`); sem ele, recarregar `/app/...` dá 404.
- ⚠️ Deploy é **Linux (case-sensitive)**: nomes de arquivo e imports precisam bater exatamente na caixa (maiúsc/minúsc), senão o build quebra só em produção.

## Autenticação / cargos
- **Cadastro é sempre `aluno`** (`login.jsx`): o signUp nunca grava cargo; `App.jsx` assume `'aluno'` quando não há linha em `profiles`.
- **Admin é manual:** inserir/editar linha em `profiles` com `cargo = 'admin'` (via Supabase). Não há promoção de admin pela UI.
- **Confirm email** está DESLIGADO no Supabase (bom para testes; religar + configurar SMTP/Resend antes de divulgar pra público real). O serviço de e-mail embutido do Supabase é limitado (~2–4/hora).

## Estrutura de componentes
- `Interface_base.jsx` — casca do painel do aluno (sidebar fixa "app-shell": só o `<main>` rola). Abas lazy-loaded: cronograma, tarefas, simulados, enem, materiais, estatisticas.
- `components/questoes/` — **compartilhado entre ENEM e Simulado**: `QuestaoCard.jsx` (render de 1 questão) + `questoesUtils.js` (FILTROS, dificuldade estimada, `nomeMateria`).
- `QuestoesEnem.jsx` — navegador de 1 questão por vez (setas, X de Y, progresso, revisar).
- `components/simulado/` — `Simulado.jsx` (config→execução→resultado) + `simuladosService.js` (histórico/ranking/conquistas/metas em **localStorage**).
- `components/onboarding/` — `OnboardingLayout` (stepper) + `PassoVestibular/PassoConfiguracao/PassoResumo`; orquestrado por `Onboarding.jsx`. Cálculo em `logica.js`.
- `estatisticas.jsx` (dashboard) + `estatisticas.js` (processamento/persistência).

## Persistência (tabelas Supabase)
- `profiles` (user_id, cargo), `cronogramas` (user_id, dados_cronograma), `materiais_estudo`, `tarefas_status`, `noticias`.
- `questoes_respondidas` (usuario_id, acertou, materia, data) — **fonte das Estatísticas**. ENEM e Simulado gravam aqui via `registrarRespostaEnem`, então o dashboard reflete tudo automaticamente.
- Simulado (histórico/ranking/metas) fica em **localStorage** — evolução futura: espelhar em tabela `simulados`.

## Comandos
- `npm run dev` (Vite), `npm run build`, `npm run lint`. Rodar **lint + build** antes de commitar (as regras `react-hooks` são estritas: nada de setState síncrono em efeito nem acesso a ref no render).
