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

## Identidade visual / Design System (jul/2026)
- **Identidade da marca** (extraída da logo "Pré-Vestibular UERJ Para Todos", em `public/logo-uerj.jpeg`): **tinta** (pretos quentes `ink-950…100`) + **ouro** (`gold-200…700`, selo da logo). Tokens Tailwind v4 definidos no `@theme` do `src/index.css` (cores, sombras `--shadow-gold/card/pop`, fontes).
- **Dois temas, uma semântica (jul/2026):** o tema claro (`[data-theme="light"]` no `<html>`) **inverte a escala ink** (950 = off-white creme … 100 = texto quase-preto), troca `gold-*` pela escala **vinho/bordô** e redefine `--color-white` como o primeiro plano do tema. Como as utilities do Tailwind v4 usam `var(--color-*)`, TODOS os componentes se adaptam sem classes por tema — **nunca escreva `dark:`/`light:` variants**; escreva na semântica ink/gold/white. Superfícies que devem ficar escuras nos 2 temas (ex.: painel de marca do login) usam a classe `.tema-escuro-fixo`. Troca: hook `useTema` (`src/hooks/useTema.js`, View Transitions + localStorage `tema`) + `BotaoTema` do kit (sidebar, header mobile, login, admin). O `index.html` aplica o tema salvo antes do 1º paint (anti-flash). Cores hardcoded (gráficos recharts etc.) devem usar `var(--color-…)`.
- **CTA primário é a assinatura**: texto preto sobre ouro (`bg-gold-400 text-ink-950`), como a placa "PARA TODOS" da logo — no claro vira texto claro sobre vinho automaticamente. Estados: esmeralda = sucesso, rosa = erro, âmbar = aviso. **Não usar azul genérico.**
- **Tipografia**: Archivo (display/títulos — `font-display`, h1–h3 já herdam via CSS) + Inter (corpo). Carregadas por Google Fonts no `index.html`.
- **Ícones**: `lucide-react` para TODA a interface (ações, navegação). Emojis só como "conteúdo" (ícones de matéria, medalhas de gamificação).
- **Kit de UI** em `src/components/ui/index.jsx`: `Botao` (variantes primario/secundario/fantasma/contorno/perigo), `Cartao`, `Selo`, `CampoTexto/CampoArea/CampoSelect`, `Alerta`, `Modal`, `EstadoVazio`, `Esqueleto`, `BarraProgresso`, `Indicador`, `CabecalhoPagina`. Util `cx` em `src/components/ui/cx.js` (arquivo separado por causa do `react-refresh/only-export-components`). **Sempre usar o kit em telas novas.**

## Stack
- **React 19 + Vite 8 + Tailwind v4** (config em `@import "tailwindcss"` no `index.css`).
- **lucide-react** (ícones).
- **framer-motion** (animações), **recharts** (gráficos).
- **Supabase** (auth + Postgres + Storage) em `src/SUPABASE.js` (credenciais via env `VITE_SUPABASE_*` com fallback embutido; a anon/publishable key é pública por design — segurança real = RLS).
- Roteamento: **react-router** por abas em `/app/:aba`.

## Deploy
- **Produção:** https://vest-app-nine.vercel.app (Vercel, deploy automático a cada `git push` no `master`).
- **Repositório:** GitHub `Josejunior-unv/projeto-1`. A app fica na subpasta **`vestibular-app/`** → na Vercel o **Root Directory = `vestibular-app`**.
- `vercel.json` faz o **fallback de SPA** (toda rota → `index.html`); sem ele, recarregar `/app/...` dá 404.
- ⚠️ Deploy é **Linux (case-sensitive)**: nomes de arquivo e imports precisam bater exatamente na caixa (maiúsc/minúsc), senão o build quebra só em produção.

## Autenticação / cargos
- **Cadastro é sempre `aluno`** (`login.jsx`): o signUp nunca grava cargo; `App.jsx` assume `'aluno'` quando não há linha em `profiles`. O **nome** do cadastro vai pra `auth.users.raw_user_meta_data->>'nome'` (não fica em `profiles`).
- **Promoção de cargo pela UI (jul/2026):** o admin troca `aluno ⇄ admin` de qualquer pessoa pela aba **👥 Usuários** do Painel do Admin (`GerenciarUsuarios.jsx`). Ainda dá pra editar `profiles` na mão via Supabase, mas não é mais necessário.
  - A tela usa 2 funções **SECURITY DEFINER** no Postgres (parte 6 do `supabase_migration.sql`): `admin_listar_usuarios()` (junta `auth.users` + `profiles` p/ trazer nome/e-mail/cargo) e `admin_definir_cargo(alvo, novo_cargo)`. Ambas checam **por dentro** se `auth.uid()` é admin — aluno não consegue chamar. `definir_cargo` faz `upsert` em `profiles` e **bloqueia o admin de rebaixar a si mesmo** (evita ficar sem admin).
  - ⚠️ Essas funções precisam existir no banco; se a aba mostrar erro de carregamento, faltou rodar a parte 6 do migration.
  - Testado end-to-end (jul/2026): login → listar → trava de auto-rebaixamento → trocar cargo de terceiro (round-trip). Tudo OK. **Os vários `admin` na lista são os professores — é intencional.**
- **Confirm email** está DESLIGADO no Supabase (bom para testes; religar + configurar SMTP/Resend antes de divulgar pra público real). O serviço de e-mail embutido do Supabase é limitado (~2–4/hora).

## Estrutura de componentes
- `Interface_base.jsx` — casca do painel do aluno (sidebar fixa "app-shell": só o `<main>` rola; colapsável no desktop, estado persistido). Abas lazy-loaded: simulados, enem, materiais (BibliotecaProvas), estatisticas.
- `Home.jsx` — dashboard da aba "Início" (cronograma): saudação com nome do aluno, indicadores de desempenho (via `processarEstatisticas`), atalhos, notícias e plano semanal.
- `BibliotecaProvas.jsx` — aba "Biblioteca UERJ" (materiais): ambiente EXCLUSIVO de provas, independente de Minhas Tarefas. Só entram materiais reconhecidos como prova (ano `(19|20)\d{2}` OU "uerj" no título/descrição); tipo deduzido por `objetiv|qualifica`/`discursiv`. Prateleiras Ano → Tipo → Matéria, filtros + ordenação persistidos, chip "Resolver online · Em breve" reservado nos cards. Materiais de aula continuam aparecendo só em Minhas Tarefas.
- `QuestoesHub.jsx` — aba "Questões": hub com o Banco ENEM em destaque (abre `QuestoesEnem`) + pastas por matéria prontas para bancos próprios (contagens no mapa `QUESTOES_POR_MATERIA`, hoje vazio → estados vazios elegantes). Estado da pasta persistido em `questoes_pasta`.
- `components/questoes/` — **compartilhado entre ENEM e Simulado**: `QuestaoCard.jsx` (render de 1 questão) + `questoesUtils.js` (FILTROS, dificuldade estimada, `nomeMateria`).
- `QuestoesEnem.jsx` — navegador de 1 questão por vez (setas, X de Y, progresso, revisar).
- `components/simulado/` — `Simulado.jsx` (config→execução→resultado) + `simuladosService.js` (histórico/ranking/conquistas/metas em **localStorage**).
- `components/onboarding/` — `OnboardingLayout` (stepper) + `PassoVestibular/PassoConfiguracao/PassoResumo`; orquestrado por `Onboarding.jsx`. Cálculo em `logica.js`.
- `estatisticas.jsx` (dashboard) + `estatisticas.js` (processamento/persistência).
- `PainelAdmin.jsx` — casca do admin, com 3 seções (state `admin_secao` persistido): **📚 Materiais**, **📰 Notícias** (`GerenciarNoticias.jsx`) e **👥 Usuários** (`GerenciarUsuarios.jsx`). Só quem tem `cargo='admin'` chega aqui (guard em `App.jsx`, rota `/admin`).

## Persistência (tabelas Supabase)
- `profiles` (user_id [PK], cargo), `cronogramas` (user_id, dados_cronograma), `materiais_estudo`, `tarefas_status`, `noticias`.
- Funções RPC de admin: `admin_listar_usuarios()`, `admin_definir_cargo(uuid, text)` — ver "Autenticação / cargos". Definidas na parte 6 do `supabase_migration.sql` (idempotente; roda no SQL Editor).
- `questoes_respondidas` (usuario_id, acertou, materia, data) — **fonte das Estatísticas**. ENEM e Simulado gravam aqui via `registrarRespostaEnem`, então o dashboard reflete tudo automaticamente.
- Simulado (histórico/ranking/metas) fica em **localStorage** — evolução futura: espelhar em tabela `simulados`.

## Comandos
- `npm run dev` (Vite), `npm run build`, `npm run lint`. Rodar **lint + build** antes de commitar (as regras `react-hooks` são estritas: nada de setState síncrono em efeito nem acesso a ref no render).
