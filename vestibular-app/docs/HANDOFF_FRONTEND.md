# HANDOFF — Agente de Frontend

> Atualizado em 09/07/2026. Este arquivo é mantido EXCLUSIVAMENTE pelo agente de
> frontend. O agente de dados mantém o `docs/HANDOFF_DATA.md`.

## Sessão 09/07/2026 (parte 2) — Code-splitting + feedback ProvasUerj

### 1. Code-splitting do bundle (pendência #2 resolvida)

O chunk inicial estava em **667 kB** (aviso do Vite de chunk > 500 kB) porque
framer-motion e supabase-js caíam no chunk `index`. Vite 8 usa **Rolldown**;
a API nativa de chunking é `build.rolldownOptions.output.codeSplitting.groups`
(NÃO `manualChunks` — está deprecada; e NÃO `advancedChunks`, que também emite
warning de deprecação). Config em `vite.config.js`: grupos por `test` regex
(usando `[\\/]` para o separador de path, exigência do Rolldown no Windows) para
`vendor-react`, `vendor-router`, `vendor-framer-motion`, `vendor-supabase` e
`vendor-recharts` (recharts + d3-* + victory-vendor).

**Distribuição de chunks (antes → depois):**

| Chunk                    | Antes      | Depois     |
| ------------------------ | ---------- | ---------- |
| `index` (inicial)        | **667 kB** | **111 kB** |
| `estatisticas`           | 359 kB     | 12,6 kB    |
| `vendor-recharts`        | —          | 347 kB     |
| `vendor-supabase`        | —          | 200 kB     |
| `vendor-react`           | —          | 190 kB     |
| `vendor-framer-motion`   | —          | 125 kB     |
| `vendor-router`          | —          | 41 kB      |

O chunk inicial caiu de 667 kB para **111 kB** (gzip 30 kB) e o **aviso de
tamanho sumiu**. recharts foi extraído do chunk `estatisticas` (que era 359 kB e
agora é 12,6 kB) — o gráfico só baixa quando a aba Estatísticas é aberta, e agora
em cache próprio. Nenhuma rota lazy quebrou (todas as `import()` por aba seguem
gerando seus chunks). Build: 2824 módulos, ~1,0s, zero warnings.

### 2. Feedback em `ProvasUerj.resolverOnline` (pendência resolvida)

Antes, se `questoesDaProva` voltasse sem questões respondíveis
(`alternativas.length > 0`), o clique em "Resolver online" era um no-op
silencioso. Agora o handler seta um estado `aviso` e renderiza um `<Alerta
variante="aviso">` (kit de UI) explicando que a prova ainda não tem questões
prontas e apontando para o PDF/gabarito abaixo. O aviso some sozinho após 6s
(effect com `clearTimeout` no cleanup). É um caso raro (o botão só aparece com
`comGabarito > 0`), mas o clique morto foi eliminado.

**Arquivos alterados nesta parte:** `vite.config.js`,
`src/components/uerj/ProvasUerj.jsx`. Lint e build limpos.

---

## Estado da sessão de 09/07/2026

**Nota de protocolo:** `docs/HANDOFF_DATA.md` ainda **não existe** — esta foi a
primeira sessão a criar a pasta `docs/`. O contexto do banco foi reconstruído
pelo `CLAUDE.md` (seção "Estado atual do projeto"). O `supabase_migration.sql`
está modificado no working tree pelo agente de dados e **não foi tocado**.

## Funcionalidades auditadas (Etapas 1–3)

- **Arquitetura geral**: `App.jsx` (guards de rota, `onAuthStateChange` com ref
  anti-remontagem, `maybeSingle`), `Interface_base.jsx` (app-shell, lazy
  loading por aba, drawer mobile), `usePersistedState`, kit de UI.
- **Fluxo de questões completo**: `QuestoesEnem.jsx`, `QuestaoCard.jsx`,
  `QuestoesHub.jsx`, `uerj/BancoQuestoesUerj.jsx`, `uerj/ExecutorQuestoes.jsx`,
  `uerj/UerjHub.jsx`, `uerj/SimuladoUerj.jsx`, `uerj/ProvasUerj.jsx`,
  `uerj/EstatisticasUerj.jsx`, serviços `uerjEstudoService.js` e
  `questoesUerjService.js`.
- **Varredura estática** do restante: keys por índice só em skeletons
  estáticos (OK), zero `console.log`, lint estrito (react-hooks) limpo.

## Bug crítico das respostas compartilhadas (Etapa 3)

**Status: JÁ ELIMINADO** (sessão de 08/07/2026) e verificado nesta sessão:

- Causa raiz: o `PaginaQuestao` (banco UERJ) guardava `resposta`/`tempo` em
  estado interno; ao navegar para outra questão o componente era REUTILIZADO
  pelo React e o estado da questão anterior vazava para a seguinte.
- Fix verificado: `key={aberta.questao.id}` força o remount por questão
  (`BancoQuestoesUerj.jsx`). Nos demais fluxos as respostas são indexadas por
  ID da questão (`respostas[q.id]` no Executor, `respostasUsuario[idQuestao(q)]`
  no ENEM) e os `motion.div` usam a key do ID — sem estado compartilhado.

## Bugs encontrados e corrigidos NESTA sessão

1. **Corrida de requisições nos filtros do banco UERJ**
   (`BancoQuestoesUerj.jsx`, efeito "etapa 1"): o guard de resposta obsoleta
   comparava só a `busca`; ao trocar dois FILTROS em sequência, a resposta da
   requisição antiga (mais lenta) podia sobrescrever a lista nova. Corrigido
   com flag `ativo` no cleanup do efeito — qualquer execução superada é
   invalidada (filtros, busca ou userId).
2. **`carregarEstudo` executado a cada render da lista**
   (`BancoQuestoesUerj.jsx`): JSON.parse do progresso inteiro a cada tecla na
   busca. Agora `useMemo` por `[userId, aberta]` — recarrega só quando o aluno
   volta de uma questão (quando o progresso pode ter mudado).
3. **Resumo obsoleto no hub da Central UERJ** (`UerjHub.jsx`): o resumo
   (respondidas/taxa/sequência) era memoizado só por `userId`; ao voltar do
   banco depois de responder questões os números não atualizavam. Deps agora
   incluem `secao`/`filtrosBanco`.
4. **Flash de "Nenhuma questão adicionada"** (`QuestoesHub.jsx`): ao recarregar
   a página com uma pasta de matéria persistida, as contagens ainda estavam em
   voo (`{}`) e o aluno via o estado vazio por um instante. `contagens` agora
   inicia como `null` (= carregando) e a pasta mostra o loading até os números
   chegarem.

## Componentes/hooks/páginas alterados

- `src/components/uerj/BancoQuestoesUerj.jsx` (fixes 1 e 2; `buscaRef` removida)
- `src/components/uerj/UerjHub.jsx` (fix 3)
- `src/components/QuestoesHub.jsx` (fix 4)

Nenhum arquivo do agente de dados foi alterado.

## Testes executados

- `npm run lint` — limpo (zero erros/warnings; regras react-hooks estritas).
- `npm run build` — sucesso (Vite 8, 2824 módulos, 1.2s).
- Smoke test Playwright (dev server + Chromium headless): app carrega, login
  renderiza, **0 erros e 0 warnings de console**.
- E2E completo (15/15, login→questões→filtros→admin) foi executado na sessão
  de 08/07/2026; as mudanças desta sessão são pontuais e cobertas pelo smoke.

## Pendências / recomendações

- ~~**Bundle principal com 667 kB**~~ — **RESOLVIDO na parte 2** (code-splitting
  via `codeSplitting.groups` do Rolldown; chunk inicial em 111 kB).
- ~~`ProvasUerj.resolverOnline` no-op silencioso~~ — **RESOLVIDO na parte 2**
  (Alerta de aviso quando não há questões respondíveis).
- Simulado ENEM (histórico/ranking/metas) segue em localStorage — evolução
  futura: espelhar em tabela `simulados` (decisão pertence ao agente de dados).
- **Para o agente de dados** (já rastreado no CLAUDE.md): falta rodar
  `update public.questoes_uerj set resposta = null where id = 7986;` no SQL
  Editor; 64 questões sem enunciado e 34 com alternativas vazias só se
  resolvem com reimportação (o frontend já degrada com aviso + link do PDF).

## Próximos passos sugeridos

1. Criar `docs/HANDOFF_DATA.md` (agente de dados) para fechar o protocolo.
2. ~~Code-splitting do chunk principal~~ — feito (parte 2, 09/07/2026).
3. E2E autenticado recorrente (contas `auditoria.claude.*@exemplo-teste.com`).
