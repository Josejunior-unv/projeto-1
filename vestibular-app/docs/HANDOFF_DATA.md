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

## Auditoria PROFUNDA de qualidade (09/07/2026) — enunciados, alternativas, gabaritos, imagens, metadados

Segunda varredura, agora além da classificação. Dump fresco (pós-Parte 12) +
checagens automáticas de cada dimensão. **NENHUMA correção aplicada** nesta
etapa (instrução: não deployar; rodar local e aguardar aprovação). Servidor
local subido em `http://localhost:5173/` para teste manual.

### O que está SÃO (verificado)
- **Estrutura**: 0 mismatch área↔disciplina, 0 gabarito inválido (fora A–D),
  0 discursiva com gabarito, 0 idioma com gabarito, **0 duplicatas**
  (prova,numero,disciplina), 0 prova com ano fora de 2012–2027.
- **Imagens que existem**: 607 questões têm imagem (1.275 refs em Storage
  público), **0 URL quebrada** na amostra testada, **0 imagem duplicada** entre
  questões. O pipeline extrai e sobe figuras raster corretamente.
- **Provas de gabarito/padrão (50 registros, 0 questões)**: NÃO são lixo — o
  `ProvasUerj.jsx` as consome como **anexos** (`acharAnexo(..., "gabarito"/
  "padrao_resposta")`) para download, vinculadas à prova real. Correto.
- **Degradação graciosa**: `QuestaoCard` avisa "enunciado não pôde ser extraído"
  e "alternativa disponível só no PDF" — sem crash/erro de runtime.

### Problemas encontrados — TODOS com a MESMA causa raiz (extração)
| Problema | Qtd | Causa raiz |
| --- | --- | --- |
| Enunciado vazio | 68 | PDF vetorial/2012 (provas 109, 111) + páginas muito diagramadas → texto não extraível |
| Objetiva sem alternativas | 9 | idem (layout quebrou a sequência A–E) |
| Alguma alternativa com texto vazio | 34 | idem |
| **Figura ausente** (menciona gráfico/tabela/mapa/charge mas `imagens=[]`) | **391** | `_exportar_imagens` só extrai raster embutido (`doc.extract_image(xref)`); **gráficos/tabelas/mapas VETORIAIS não são capturados** |
| Objetiva não-idioma sem gabarito | 120 | matcher de gabarito por (ano,fase) não casou essas posições |

União de defeitos de texto: **110 questões** distintas.

### Diagnóstico técnico (causa raiz única)
Todos os itens acima são limitação do **pipeline de extração** (`extrair.py`),
não corrupção do banco. Especificamente:
1. **Figuras vetoriais** (a maioria dos gráficos/tabelas/mapas da UERJ são
   desenhos vetoriais, não imagens embutidas) não são capturadas — daí as 391
   "figura ausente". Correção definitiva: renderizar a REGIÃO da figura da
   página para raster (ex.: `page.get_pixmap(clip=bbox)`), não só `extract_image`.
2. **Texto vetorial / layout denso** (2012 + páginas diagramadas) → 110 questões
   com enunciado/alternativa faltando.
3. **Matcher de gabarito** deixou 120 objetivas sem resposta.

**Nenhum desses é corrigível por SQL sem inventar dado** (seria gambiarra
proibida). A solução definitiva é **melhorar `extrair.py` + reimportar**
(`python main.py` com service key) — o que troca IDs das questões e zera o
progresso local do banco UERJ (`questoes_respondidas`/Estatísticas sobrevive).
Reimportar é efetivamente um deploy de dados → **aguardando aprovação do dono**.

### Próximos passos (aguardando aprovação)
1. Melhorar `_exportar_imagens` (render de região vetorial) e a robustez de
   texto/gabarito no `extrair.py`.
2. Rodar `python main.py` (reimport completo) com service key.
3. Re-auditar (as mesmas checagens) e confirmar queda dos 5 indicadores.
4. Só então commit/push/deploy.

### Prototipagem/validação de 09/07/2026 (o que aprendi antes de reimportar)
Com aprovação, comecei a melhorar o extrator. Validei em PDFs em cache (699
baixados; sem service key ainda — publicação é passo à parte). Conclusões:

- **Render de figura vetorial FUNCIONA** (`page.get_pixmap(clip=bbox, dpi=150)`):
  renderizei os 2 mapas da França (prova 252) e o triângulo de Matemática com
  qualidade ótima. **Atribuição por banda ("Questão NN" → região)** é confiável.
- **PORÉM a DETECÇÃO da bbox da figura é iterativa**: em 1 passe automático o
  detector pegou ~7 de ~20 figuras da prova, perdeu a timeline "DIVISÃO DA
  HISTÓRIA" (marcador "Questão"+número em blocos separados) e cortou o Mapa 2
  (página frontal é COLUNA ÚNICA, o split de 2 colunas quebrou a figura). Ou
  seja: chegar ao padrão "grande plataforma" exige ciclos detectar→renderizar→
  conferir-visualmente→ajustar por arquétipo de figura (mapa, timeline, barras,
  pirâmide, tabela, estrutura química, diagrama de física). **Não é passe único.**
- **Gabarito — causa raiz achada e método validado**: o `extrair_gabarito`
  descartava PDFs porque `inferir_edicao` só acha "Vestibular Estadual AAAA"
  contíguo; nos gabaritos o ano fica solto. Reescrevi a leitura por
  `_gabarito_por_sequencia` (layout "área→coluna de números→coluna de letras")
  + edição pelo NOME do arquivo → **reproduzi 697 gabaritos conhecidos com 100%
  de acerto, 0 divergência**. MAS ⚠️ o ano **nunca** pode vir do conteúdo (a
  data de realização é do ano anterior: vi `2013_1eq`→2012, `2025`→prova de
  09/06/2024). Cobertura do patch standalone: só recupera ~1/120 com segurança,
  porque os faltantes estão em provas de nome numérico (`252_gabarito…`) que
  precisam do mapeamento anexo→ano do pipeline. **Recuperar os 120 com segurança
  = corrigir a resolução de edição no pipeline + reimport** (a extração em si já
  é 100% confiável quando a edição está certa).

### Execução das etapas A→C (09/07/2026, aprovado "vai fundo, só reimporta quando provado")

**ETAPA A (gabaritos) — PROVADA ✅.** Simulei o estágio de gabarito do pipeline
com os PDFs em cache (edição do manifesto/crawler + fallback por pasta +
retificados por último = exatamente o `main.py`). Resultado:
- **Validação: reproduz os 1.196 gabaritos conhecidos com 100%% de acerto, 0
  divergência, 0 ausente.** Método confiável.
- **Recupera 54 dos 120 faltantes** (validados). Os 66 restantes: gabarito extrai
  parcial (2013: 29) ou é edição sem fonte confiável (2023 EU: 14, 2025 2EQ: 11).
- A extração ATUAL já funciona — a produção foi publicada por versão mais fraca.
  Logo o reimport aplicará os 54; ou pode-se aplicar o patch **Part 13**.
- ⚠️ Regra de ouro confirmada: o ano do gabarito **nunca** vem do conteúdo (a data
  de realização é do ano anterior). Sempre nome do arquivo / edição do crawler.

**PARTE 13 — GERADA, VALIDADA E JÁ ANEXADA AO `supabase_migration.sql`
(09/07/2026).** Deixou de ser patch solto: agora é a Parte 13 do arquivo (bloco
após a Parte 12), com um gerador versionado `scripts/importador_uerj/gerar_part13.py`.
- **Causa raiz confirmada** (linha ~168 do `main.py`): o gabarito-tabela antigo
  `uploads/2019/06/Gabarito.pdf` (1º EQ 2020, prova 94) tem nome sem ano/fase e
  conteúdo que NÃO imprime "Vestibular Estadual" → é descartado como "outro
  certame" com `continue` **antes** da linha 183 que alimentaria o fallback por
  pasta. Resultado: as 53 objetivas da prova 94 ficaram sem gabarito. Correção
  definitiva no pipeline exigiria reimport (troca IDs, perde a Part 12); por isso
  a recuperação foi feita **cirurgicamente por SQL**.
- **`gerar_part13.py`** reproduz o casamento gabarito→prova do pipeline (edição +
  pasta) **sem o descarte prematuro** e então: (1) VALIDA contra produção —
  **reproduz os 1.196 gabaritos existentes com 0 divergência** (qualquer
  divergência ABORTA a geração); (2) emite `update ... set resposta='X' where
  id=N and resposta is null` só para objetivas não-idioma hoje sem gabarito, e só
  de provas cuja validação ficou 100% limpa.
- **Resultado: 53 UPDATEs, todos da prova 94** (nºs 1–21 e 29–60, faixa de idioma
  23–27 excluída), distribuição de letras A=13/B=13/C=13/D=14 (balanceada = sinal
  de gabarito genuíno e alinhado). A pasta `uploads/2019/06/` contém exatamente
  1 prova + 1 gabarito (pareamento inequívoco). Os outros 66 nulls (2013 parcial,
  2023 EU, 2025 2EQ) seguem sem fonte confiável → o gerador não inventa nada.
- Idempotente/aditivo (`and resposta is null`). Regenerável: `python gerar_part13.py`.

**ETAPA B (figuras) — detector salvo em `scripts/importador_uerj/figuras.py`,
validado em layouts modernos; layouts antigos pendentes.**
- Render (`get_pixmap(clip=bbox)`) é ótimo; atribuição por banda "Questão NN" é
  sólida. Resolvi 3 casos: coluna inferida dos PRÓPRIOS marcadores (mata o
  falso-positivo de 2 colunas na página frontal, que cortava figura no meio);
  aceitar figura fina larga (timeline) além de área mínima; incluir rótulos-texto
  curtos adjacentes no bbox.
- ✅ **Validado por leitura visual (jul/2026)**: mapas da França (raster, 2
  lado a lado + títulos + fontes), timeline "Divisão da História" (vetor fino +
  todos os rótulos), triângulo de geometria — todos perfeitos. Prova 2025/2EQ:
  **22 figuras** coerentes; prova 2013: 21.
- ✅ **Layouts ANTIGOS (≤2020) RESOLVIDOS**: o rótulo era `questão\n01` em
  MINÚSCULAS e o regex não tinha `IGNORECASE`. Com o fix, 2018: 0→24 figuras,
  2016: 29, 2019: 30 (sem regressão nos modernos). Validei visualmente 2018 Q01
  (imagem do Star Trek + moldura).
- ✅ **Anti-ruído**: filtro que ignora a MOLDURA da questão (retângulo que
  preenche a coluna) — exige raster OU ≥3 traços vetoriais. 2018 caiu 30→24.
- ✅ **GANHO MEDIDO (casando por hash com a produção)**: **+195 questões que HOJE
  não têm imagem ganhariam uma figura real** (spot-check visual: gráfico θ×Q de
  Física, gráfico de linha de feminicídios, mapas, timeline — todos reais e bem
  recortados). O "391" da heurística superestimava (menções a "observe"/"texto").
- ✅ **Design ADITIVO (sem regressão)**: das 607 questões que já têm imagem, o
  detector confirma 375 (com recorte melhor). As outras 232 continuam pela
  extração raster atual (`_exportar_imagens`) como fallback → **nada se perde**.
  Combinado ≈ 607 + 195 ≈ 802 questões com figura.
- ✅ **INTEGRADO e VALIDADO ponta a ponta** (`extrair.py` chama `figuras.py`,
  renderiza a região via `_render_figura`, com raster como fallback). Rodei
  `python main.py --sem-crawl --sem-publicar` no corpo inteiro (108 provas, 1947
  questões, exit 0). Re-auditoria do JSON gerado:
  - **799 questões com figura** (era 607) = **+192 líquidas**; 704 são renders
    de região (figuras vetoriais novas).
  - **enunciado vazio 68→68, alternativa vazia 34→34 = ZERO regressão de texto.**
- **ETAPA B = PRONTA para reimport.** Falta só publicar (service key + aprovação).

**ETAPA C (texto/2012) — reescopada, BAIXO valor restante.** Os PDFs de 2012 TÊM
texto (62 mil chars); o que falta são os NÚMEROS de questão (vetoriais) →
`RE_QUESTAO` não segmenta. OCR de página não resolve limpo e o Tesseract nem
está instalado. Sobre os 68 enunciados vazios: **todos os 68 têm alternativas
(são respondíveis)**, 0 são inúteis (sem figura E sem alternativa), e 4 ganharam
figura que mostra o conteúdo. Com o aviso gracioso do `QuestaoCard` ("enunciado
não pôde ser extraído — veja o PDF"), o ganho de corrigi-los é pequeno e exige
trabalho caso a caso de extração. **Deixado como está** (baixa prioridade).

### ENTREGA PRONTA (cirúrgica, sem reimport) — aguarda service key + aprovação
Tudo que NÃO precisa da service key está feito e validado local:
- **`publicar_figuras.py`** (novo, no repo): sobe os PNGs e faz PATCH só em
  `imagens`, casando extração→produção por (hash, número, idioma). Dry-run:
  **1947 casadas, 0 sem match, 192 GANHAM figura, 0 perderiam** (aditivo).
  Preserva IDs, Part 12, Part 13 e progresso local.
- **Part 13** (53 gabaritos da prova 94) — **já anexada ao `supabase_migration.sql`**
  (não é mais patch solto), com gerador versionado `gerar_part13.py`. Validada
  (1.196 gabaritos existentes reproduzidos, 0 divergência).
- Para publicar: rodar a Parte 13 no SQL Editor (ou recolar o migration inteiro,
  idempotente) + `SUPABASE_SERVICE_ROLE_KEY=... python publicar_figuras.py
  --publicar` para as figuras. Ambos cirúrgicos, sem reimport.
- ⚠️ NÃO fazer `python main.py` completo: trocaria IDs e perderia a Part 12/13.

### Recomendação técnica (honesta)
Os 2 maiores problemas (391 figuras, 120 gabaritos) só se resolvem BEM com
melhoria do pipeline + **um** reimport (que troca IDs e zera progresso local do
banco UERJ). Fazer um reimport agora, com o extrator de figuras meio pronto,
gastaria esse custo único num resultado incompleto/inconsistente (figura
cortada é pior que figura ausente; gabarito errado é pior que ausente). Plano
correto = trabalho ITERATIVO no `extrair.py` com QA visual, validar em várias
provas, e só então o reimport único. **Nenhuma alteração aplicada; app rodando
em localhost:5173 para teste manual; aguardando decisão do dono sobre o ritmo.**

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
12. **Auditoria completa de classificação** (09/07): 115 `UPDATE`s validados
    (reclassificações de fronteira + Não Classificada lidas + correções de área +
    espanhol sem gabarito). Gerada pela varredura das 1.947 questões.
13. **Recuperação de gabaritos** (09/07): 53 `UPDATE`s de `resposta` para a prova
    94 (1º EQ 2020), gerados por `scripts/importador_uerj/gerar_part13.py` e
    validados (reproduz 1.196 gabaritos existentes, 0 divergência). Idempotente
    (`and resposta is null`).

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

2. **Rodar as Partes 12 e 13** no SQL Editor — recolar o `supabase_migration.sql`
   inteiro (idempotente) OU só os blocos "PARTE 12" e "PARTE 13".
   - **Parte 12** (auditoria de classificação): 115 `UPDATE`s validados (0
     mismatch). "Não Classificada" cai de 284 para ~181 + 6 reclassificações de
     fronteira.
   - **Parte 13** (gabaritos): 53 `UPDATE`s validados (reproduz 1.196 gabaritos
     existentes com 0 divergência). Recupera o gabarito da prova 94 (1º EQ 2020),
     que o pipeline descartava. Objetivas não-idioma sem gabarito: 120 → 67.

3. **Publicar as figuras** (opcional, cirúrgico, sem reimport): com a service key,
   `SUPABASE_SERVICE_ROLE_KEY=... python scripts/importador_uerj/publicar_figuras.py
   --publicar`. Dry-run confirmado: 192 questões ganham figura, 0 perdem. Requer
   `questoes_extraidas.json` no cache (já presente). Aditivo, preserva IDs/Part 12/13.

4. **Rotacionar a service role key** exposta no chat de 08/07/2026:
   Supabase → Settings → API → Reset `service_role` key. Atualizar o
   `$env:SUPABASE_SERVICE_ROLE_KEY` do ambiente do pipeline. **Confirmar nesta
   ou na próxima sessão se já foi feito.**

5. **(Opcional, só melhora residual)** Reimportar o acervo (`python main.py`
   com service key) para resolver as 64 questões sem enunciado, 34 com
   alternativas vazias e a classificação fina dos Exames Únicos — as regras já
   estão corrigidas na origem. ⚠️ Reimportar troca os IDs das questões e zera o
   progresso local do banco UERJ (o `questoes_respondidas`/Estatísticas
   permanece). Substitui as Partes 12/13 pela extração — só vale quando o extrator
   estiver 100% (figuras + gabaritos + classificação na origem).

6. **(Higiene)** As contas de teste E2E `auditoria.claude.*@exemplo-teste.com`
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
