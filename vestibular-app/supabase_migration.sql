-- ============================================================================
-- SETUP DO SUPABASE — Materiais, Upload de PDF, Tarefas, Conclusão e Notícias
-- Rode no Supabase: Dashboard > SQL Editor > New query > cole tudo > Run.
-- É PostgreSQL e é 100% idempotente (pode rodar quantas vezes quiser).
-- (Se seu EDITOR LOCAL acusar erro de sintaxe, ignore — ele valida como SQL
--  Server. O que vale é rodar no SQL Editor do Supabase.)
-- ============================================================================

-- 1) Colunas da área do professor (material + arquivo enviado)
--    Inclui materia/descricao/criado_em, que o código usa mas não existiam
--    na tabela original (por isso publicar material nunca funcionava).
alter table public.materiais_estudo
  add column if not exists materia text,
  add column if not exists descricao text,
  add column if not exists criado_em timestamptz default now(),
  add column if not exists tipo text default 'material',
  add column if not exists professor_nome text,
  add column if not exists storage_path text,
  add column if not exists arquivo_nome text,
  add column if not exists arquivo_tamanho bigint,
  add column if not exists ordem integer default 0;

-- 1b) RLS de materiais_estudo: todos leem; professor gere os seus.
alter table public.materiais_estudo enable row level security;

drop policy if exists "materiais leitura" on public.materiais_estudo;
create policy "materiais leitura" on public.materiais_estudo
  for select using (true);

drop policy if exists "materiais insert" on public.materiais_estudo;
create policy "materiais insert" on public.materiais_estudo
  for insert to authenticated with check (auth.uid() = usuario_id);

drop policy if exists "materiais update" on public.materiais_estudo;
create policy "materiais update" on public.materiais_estudo
  for update to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "materiais delete" on public.materiais_estudo;
create policy "materiais delete" on public.materiais_estudo
  for delete to authenticated using (auth.uid() = usuario_id);

-- 2) Conclusão de tarefas por aluno (sincroniza entre dispositivos)
create table if not exists public.tarefas_status (
  usuario_id uuid references auth.users(id) on delete cascade,
  material_id uuid references public.materiais_estudo(id) on delete cascade,
  concluido boolean default true,
  atualizado_em timestamptz default now(),
  primary key (usuario_id, material_id)
);
alter table public.tarefas_status enable row level security;

drop policy if exists "aluno gerencia seu status" on public.tarefas_status;
create policy "aluno gerencia seu status"
  on public.tarefas_status for all
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- 3) NOTÍCIAS (mural do administrador)
create table if not exists public.noticias (
  id bigint generated always as identity primary key,
  titulo text not null,
  descricao text,
  imagem_url text,
  link text,
  prioridade integer default 0,
  data_publicacao date default current_date,
  publicado boolean default true,
  autor_nome text,
  criado_em timestamptz default now()
);
alter table public.noticias enable row level security;

drop policy if exists "ler noticias" on public.noticias;
create policy "ler noticias" on public.noticias for select
  using (
    publicado = true
    or exists (select 1 from public.profiles p
               where p.user_id = auth.uid() and p.cargo = 'admin')
  );

drop policy if exists "admin gerencia noticias" on public.noticias;
create policy "admin gerencia noticias" on public.noticias for all
  using (exists (select 1 from public.profiles p
                 where p.user_id = auth.uid() and p.cargo = 'admin'))
  with check (exists (select 1 from public.profiles p
                      where p.user_id = auth.uid() and p.cargo = 'admin'));

-- 4) STORAGE — bucket público para os PDFs (isolado em bloco à prova de falha,
--    para não derrubar as tabelas acima caso o Storage tenha alguma restrição)
do $$ begin
  insert into storage.buckets (id, name, public)
  values ('materiais', 'materiais', true)
  on conflict (id) do nothing;

  drop policy if exists "upload materiais" on storage.objects;
  create policy "upload materiais" on storage.objects for insert to authenticated
    with check (bucket_id = 'materiais');

  drop policy if exists "ler materiais" on storage.objects;
  create policy "ler materiais" on storage.objects for select
    using (bucket_id = 'materiais');

  drop policy if exists "excluir materiais" on storage.objects;
  create policy "excluir materiais" on storage.objects for delete to authenticated
    using (bucket_id = 'materiais');
exception when others then
  raise notice 'Storage nao configurado via SQL (configure o bucket manualmente): %', sqlerrm;
end $$;

-- 5) REALTIME (OPCIONAL) — isolado em blocos que NÃO abortam o script se a
--    tabela já estiver na publicação. Deixado por último de propósito.
do $$ begin
  alter publication supabase_realtime add table public.materiais_estudo;
exception when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.noticias;
exception when others then null; end $$;

-- 6) GESTÃO DE USUÁRIOS — trocar cargo (aluno <-> admin) pelo Painel do Admin.
--    Duas funções SECURITY DEFINER: rodam com o privilégio do dono e checam,
--    por dentro, se QUEM chamou é admin. Assim o painel consegue LISTAR todos
--    os usuários (com nome/e-mail vindos de auth.users) e TROCAR o cargo de
--    qualquer um, sem precisar abrir a RLS da tabela profiles para terceiros.

create or replace function public.admin_listar_usuarios()
returns table (user_id uuid, nome text, email text, cargo text, criado_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.cargo = 'admin'
  ) then
    raise exception 'Acesso negado: apenas administradores.';
  end if;

  return query
  select
    u.id,
    coalesce(nullif(u.raw_user_meta_data->>'nome', ''),
             split_part(u.email, '@', 1)) as nome,
    u.email::text,
    coalesce(p.cargo, 'aluno') as cargo,
    u.created_at
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_definir_cargo(alvo uuid, novo_cargo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.cargo = 'admin'
  ) then
    raise exception 'Acesso negado: apenas administradores.';
  end if;

  if novo_cargo not in ('aluno', 'admin') then
    raise exception 'Cargo invalido: %', novo_cargo;
  end if;

  -- Trava: um admin não pode rebaixar a si mesmo (evita ficar sem admin nenhum).
  if alvo = auth.uid() and novo_cargo <> 'admin' then
    raise exception 'Voce nao pode remover o seu proprio acesso de admin.';
  end if;

  insert into public.profiles (user_id, cargo)
  values (alvo, novo_cargo)
  on conflict (user_id) do update set cargo = excluded.cargo;
end;
$$;

grant execute on function public.admin_listar_usuarios() to authenticated;
grant execute on function public.admin_definir_cargo(uuid, text) to authenticated;

-- ============================================================================
-- Verificação rápida (deve retornar as 3 linhas abaixo sem erro):
select 'materiais_estudo.tipo' as ok
  from information_schema.columns
  where table_name = 'materiais_estudo' and column_name = 'tipo'
union all select 'tabela tarefas_status' from information_schema.tables
  where table_name = 'tarefas_status'
union all select 'tabela noticias' from information_schema.tables
  where table_name = 'noticias';
