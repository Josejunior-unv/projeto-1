# HANDOFF — Agente de Dados

> Criado em 09/07/2026. Este arquivo é mantido EXCLUSIVAMENTE pelo agente de
> dados. O agente de frontend mantém o `docs/HANDOFF_FRONTEND.md` — leia-o para
> contexto, mas não o edite. Minha raia: `supabase_migration.sql`,
> `scripts/importador_uerj/**` e este arquivo. Não toco em `src/**` nem no
> `vite.config.js`.

## Estado da sessão de 09/07/2026

Primeira sessão a criar este handoff — fecha o protocolo de handoffs (o
frontend já tinha o dele). O contexto de dados foi reconstruído a partir do
`CLAUDE.md` (seção "Estado atual do projeto") e da leitura integral do
`supabase_migration.sql` no working tree.

Nesta sessão o `supabase_migration.sql` recebeu a **Parte 12** (auditoria
completa de classificação — ver abaixo). Não temos acesso ao banco de produção
daqui, então nada foi rodado; toda ação que depende do banco está listada em
"AÇÕES PENDENTES DO DONO".

---

## Auditoria completa de classificação (09/07/2026) — Parte 12

Auditoria exaustiva das **1.947 questões** da UERJ (lidas via PostgREST com a
anon key; leitura é pública). Método: dump local + verificação estrutural
determinística + re-audit de conteúdo + leitura questão a questão das
"Não Classificada". Scripts em `%TEMP%/uerj_audit/` (efêmeros).

**Achado principal — integridade estrutural já era perfeita:** 0 mismatch
área↔disciplina, 0 disciplina nula, 0 idioma com gabarito. O filtro do banco
(`eq disciplina`) já era confiável. A oportunidade estava nas **284 questões
"Não Classificada"** (os Exames de Qualificação/Únicos, cuja estrutura oficial
da UERJ é só por ÁREA, não por disciplina).

**115 correções de alta confiança** (validadas por leitura, simuladas contra
o dump → 0 mismatch, cada filtro retorna só sua área canônica):
- **6 reclassificações de questões já rotuladas** que eram artefato de fronteira
  de bloco (ex.: mendelévio/xenônio/mitocôndria/resistores rotulados
  "Matemática" por caírem na última questão do bloco de Matemática; fordismo
  rotulado "Biologia"). Conteúdo íntegro, só o rótulo errado.
- **~99 "Não Classificada" de Ciências da Natureza / Matemática / idiomas**
  classificadas por leitura (Bio/Física/Química/Matemática são inequívocos no
  conteúdo; a heurística de palavra-chave do `classificar.py` as perdia porque
  termos como "eritrócitos"/"gametas"/"celomático" não estão no MAPA).
- **~10 correções de ÁREA** de questões de fronteira cujo rodapé real é
  "Ciências Humanas"/"Geografia"/"História" mas tinham sido rotuladas
  "Ciências da Natureza"/None (ex.: Ponte Rio-Niterói, cartograma de religiões,
  favela da Maré). Removem poluição do filtro de área.
- **6 questões de espanhol** (7921/7923/7925/7983/7984/7985) classificadas como
  Espanhol **com `resposta=null`** (regra: idioma nunca tem gabarito).

**NÃO alterei as 154 questões objetivas de Ciências Humanas** ainda "Não
Classificada": a estrutura oficial da UERJ nesses exames é por ÁREA (elas já têm
`area='Ciências Humanas'` correta) e a subdisciplina (História×Geografia×
Sociologia) é genuinamente interdisciplinar — classificar seria inferência de
baixa confiança e reintroduziria erro. Decisão consistente com a filosofia do
`classificar.py` ("melhor Não Classificada do que rotular errado").

Resultado pós-Parte 12 (simulado): "Não Classificada" cai de **284 → 181**;
16 questões ficaram como MÉDIA confiança (ambíguas Física×Matemática etc.) e
não entraram no SQL; ~5 têm enunciado vazio (só resolvem por reimportação).

**Resíduo conhecido:** as 6 reclassificações de fronteira mantêm o `resposta`
original (não nulei gabaritos aparentemente válidos); se a numeração estava
deslocada, o gabarito pode não bater — só a reimportação (`python main.py`)
resolve com certeza.

---

## Mapa do lado de dados

### Tabelas (Postgres / Supabase)

| Tabela | Chave | Papel | RLS |
| --- | --- | --- | --- |
| `profiles` | `user_id` (PK) | cargo do usuário (`aluno`/`admin`) | leitura só do próprio cargo; escrita só via RPC `admin_definir_cargo` (SECURITY DEFINER) |
| `materiais_estudo` | `id` | materiais da área do professor + PDFs | leitura pública; escrita/edição/exclusão só de **admin**, sempre como dono (parte 9a) |
| `tarefas_status` | (`usuario_id`,`material_id`) | conclusão de tarefa por aluno | dono gerencia o seu |
| `noticias` | `id` | mural do admin | leitura pública quando `publicado`; escrita só admin |
| `cronogramas` | `user_id` | cronograma do aluno | dono gerencia o seu (parte 9d) |
| `questoes_respondidas` | (usuario_id, …) | **fonte das Estatísticas** (ENEM + Simulado gravam aqui) | insert/select só do dono; sem update/delete (histórico só de acréscimo) — parte 9e |
| `provas_uerj` | `id` | provas importadas da UERJ; `hash_sha256` unique | leitura pública; escrita admin/service-role (parte 7) |
| `questoes_uerj` | `id` | questões extraídas; `+area`; unique por (prova, numero, disciplina) | leitura pública; escrita admin/service-role (partes 7 e 8) |
| `uerj_import_logs` | `id` | logs do pipeline + denúncias de questão do aluno | admin lê/insere; aluno só insere `denuncia_questao` limitada (parte 8) |

Storage: bucket público **`materiais`** (`materiais/uerj/...`). Leitura
pública; upload e exclusão só de admin (parte 9b).

### RPCs de admin (SECURITY DEFINER — parte 6)

- `admin_listar_usuarios()` — junta `auth.users` + `profiles` (nome/e-mail/cargo).
- `admin_definir_cargo(alvo uuid, novo_cargo text)` — upsert em `profiles`;
  bloqueia o admin de rebaixar a si mesmo. Ambas checam por dentro se
  `auth.uid()` é admin. Alimentam a aba **👥 Usuários** do Painel do Admin.

### Pipeline de importação (`scripts/importador_uerj/`, Python)

Pipeline offline, idempotente e incremental. Ordem:
`crawler.py` → `baixar.py` → `extrair.py` → `classificar.py` → `publicar.py`
(orquestrado por `main.py`). Ver `scripts/importador_uerj/README.md` para
comandos e detalhes. Pontos críticos já consolidados no CLAUDE.md:

- **Ano/fase NUNCA vêm da pasta de upload do WordPress** (`uploads/AAAA/MM/` é
  data de upload). Ordem dos sinais: padrão `/anexos/AAE/` → nome do arquivo →
  texto do link → conteúdo do PDF ("Vestibular Estadual AAAA").
- PDFs de 2 colunas são reordenados por coluna; área/idioma lidos do rodapé.
- **Língua estrangeira (23–27)**: 3 idiomas com a mesma numeração, todos
  importados (unicidade inclui disciplina), **nunca recebem gabarito** (coluna
  do gabarito é por idioma; casar errado corrige o aluno com a resposta de
  outra língua).
- `classificar.py` **não chuta disciplina sem área** → "Não Classificada".
- Publicação: upsert de prova por hash + **substituição total** das questões da
  prova + remoção de provas obsoletas. Reimportar **troca os IDs** das questões
  (progresso local do banco UERJ zera; `questoes_respondidas` permanece).
- Requer `truststore` (o certificado do site não valida com certifi).
- Credenciais: `SUPABASE_SERVICE_ROLE_KEY` (recomendada, ignora RLS) OU conta
  admin + anon key. **Modo degradado**: se a parte 8 da migration não existir no
  banco, o publicador detecta (sonda a coluna `area`) e publica sem `area` + 1
  idioma por número, com aviso — nunca falha por schema desatualizado.

### Estado do acervo em produção (desde 08/07/2026)

108 provas (2012–2027), 1.947 questões (100% com 0 ou 4 alternativas), 1.214
com gabarito oficial, ~87% com área preenchida, 297 "Não Classificada"
(corrigíveis na aba admin), zero duplicatas/órfãs/lixo. 2012 entrou só como PDF
(numeração vetorial). Resíduos conhecidos, só resolvidos por reimportação
(`python main.py`, já corrigido na origem): 64 questões sem enunciado extraído
e 34 com alternativas de texto vazio (o frontend degrada com aviso + link do
PDF); classificação fina dentro dos Exames Únicos interdisciplinares.

---

## Estrutura do `supabase_migration.sql`

Um único arquivo, **100% idempotente**, rodado inteiro no SQL Editor do
Supabase. Partes:

1. Colunas de `materiais_estudo` + 1b RLS inicial (permissiva — substituída em 9a).
2. `tarefas_status`.
3. `noticias`.
4. Storage (bucket + policies, bloco à prova de falha).
5. Realtime (opcional, isolado).
6. RPCs de admin (`admin_listar_usuarios`, `admin_definir_cargo`).
7. `provas_uerj`, `questoes_uerj`, `uerj_import_logs` + RLS.
8. `area` em `questoes_uerj`, unicidade por (prova, numero, disciplina),
   índices, política de denúncia do aluno.
9. **Segurança (RLS revisada)** — 9a materiais só admin, 9b Storage só admin,
   9c profiles, 9d cronogramas, 9e questoes_respondidas. As políticas antigas
   dessas tabelas são dropadas dinamicamente (via `pg_policies`) antes de
   recriar. ⚠️ A 1b cria a policy permissiva de materiais e a 9a a substitui —
   **o script tem que rodar SEMPRE inteiro** (rodar só metade deixa a brecha).
10. **Correções de dados (auditoria 08/07)**: 10a limpa gabaritos de idioma;
    10b deriva `area` canônica da disciplina.
11. **Cadernos discursivos de língua estrangeira mal classificados**: 11a os 3
    cadernos (prova_id 7/67/390) viram Linguagens/Português; 11b erros pontuais
    de área cruzada por ID; 11c Humanas rotulado como Natureza nos Exames Únicos
    2022/2023.

Verificação final: um `select` que confirma colunas/tabelas.

---

## Auditoria das pendências (o que foi conferido nesta sessão)

### 1. A parte 11b grava `resposta = null` para a questão 7986? — SIM ✅

Confirmado por leitura do arquivo (linhas 500–503) e pelo `git diff`. O UPDATE
que reclassifica o 7986 para Espanhol agora inclui `resposta = null` no mesmo
comando:

```sql
update public.questoes_uerj
   set disciplina = 'Espanhol', area = 'Linguagens', classificada = true,
       resposta = null
 where id = 7986;
```

O `git diff` mostra que essa linha (`resposta = null` + comentário explicativo)
foi **adicionada no working tree** — antes o 11b só trocava disciplina/área.

### 2. A ação manual `update ... where id = 7986` ainda é necessária?

**Depende do que o dono for rodar** — documentado abaixo em AÇÕES PENDENTES:

- **Cenário provável (produção hoje):** o dono já rodou as partes 10 e 11 em
  08/07/2026, mas com a **versão antiga do 11b** (sem `resposta = null`). Como
  a 10a roda antes da 11b e a versão antiga não zerava a coluna, a 7986 ficou
  como **Espanhol com `resposta` preenchida** — exatamente o caso que "idioma
  nunca tem gabarito" proíbe. Ou seja, **em produção o 7986 ainda está errado**.
- **Correção:** basta o dono aplicar a versão nova. Como a 11b corrigida é
  idempotente e determinística, **re-rodar o `supabase_migration.sql` inteiro
  resolve o 7986** (a 11b agora zera a resposta) — o one-liner manual deixa de
  ser estritamente necessário SE o arquivo inteiro for recolado.
- **Se o dono NÃO quiser recolar o arquivo inteiro**, o one-liner manual
  continua sendo o fix mínimo e suficiente.

Conclusão: **uma das duas ações abaixo (não as duas)** deixa o 7986 correto.

### 3. A migration é idempotente e pode ser re-rodada inteira? — SIM ✅

Todo DDL usa `if not exists` / `create or replace` / `drop policy if exists …
create` / `on conflict do nothing`. Os UPDATEs das partes 10 e 11 são
determinísticos e condicionados (por disciplina/prova_id/id), convergindo
sempre para o mesmo estado — re-rodar não causa efeito colateral. Blocos de
Storage/Realtime são isolados em `do $$ … exception when others then …` para
não abortar o script. **Recomendação permanente: rodar sempre o arquivo
inteiro, nunca pedaços** (a interação 1b↔9a exige isso).

### 4. Service role key colada no chat de 08/07 — rotação

Registrada como pendência de confirmação com o dono. A service role key
**ignora RLS** e foi exposta no chat; precisa ser rotacionada
(Supabase → Settings → API → Reset `service_role` key) e o valor novo usado só
no ambiente do pipeline (`$env:SUPABASE_SERVICE_ROLE_KEY`), nunca no frontend.
Enquanto não confirmado, tratar como pendência de segurança aberta.

---

## AÇÕES PENDENTES DO DONO

1. ~~**Corrigir a questão 7986 em produção**~~ ✅ **FEITO em 09/07/2026** — o
   dono rodou `update public.questoes_uerj set resposta = null where id = 7986;`
   no SQL Editor. A questão agora está como Espanhol sem gabarito (correto).

2. **Rodar a Parte 12** (auditoria de classificação) no SQL Editor — são 115
   `UPDATE`s idempotentes já validados (simulação → 0 mismatch, cada filtro só
   com sua área). Recolar o `supabase_migration.sql` inteiro (idempotente) OU
   só o bloco "PARTE 12". Depois de rodar, o banco fica com "Não Classificada"
   caindo de 284 para ~181 e as 6 reclassificações de fronteira corrigidas.

3. **Rotacionar a service role key** exposta no chat de 08/07/2026:
   Supabase → Settings → API → Reset `service_role` key. Atualizar o
   `$env:SUPABASE_SERVICE_ROLE_KEY` do ambiente do pipeline. **Confirmar nesta
   ou na próxima sessão se já foi feito.**

4. **(Opcional, só melhora residual)** Reimportar o acervo (`python main.py`
   com service key) para resolver as 64 questões sem enunciado, 34 com
   alternativas vazias e a classificação fina dos Exames Únicos — as regras já
   estão corrigidas na origem. ⚠️ Reimportar troca os IDs das questões e zera o
   progresso local do banco UERJ (o `questoes_respondidas`/Estatísticas
   permanece).

5. **(Higiene)** As contas de teste E2E `auditoria.claude.*@exemplo-teste.com`
   podem ser apagadas no painel do Supabase quando não forem mais usadas.

---

## Notas para a próxima sessão de dados

- Antes de divulgar ao público real: religar **Confirm email** no Supabase e
  configurar SMTP/Resend (o serviço embutido é limitado a ~2–4 e-mails/hora).
- Evolução futura pedida pelo frontend: espelhar o histórico/ranking/metas do
  Simulado ENEM (hoje em `localStorage`) numa tabela `simulados` — decisão de
  modelagem pertence a esta raia.
- ⚠️ **Limite de 1000 linhas do PostgREST**: qualquer consulta que possa passar
  disso usa `coletarTudo()` (paginação). Nunca confiar em `.range(0, 4999)`.
- Ao adicionar API externa nova, lembrar que a CSP do `vercel.json` (raia do
  frontend) precisa liberar o host em `connect-src` — coordenar com o frontend.
