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
