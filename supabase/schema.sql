-- Controle de Colaboradores — esquema do Supabase.
-- Execute no painel do Supabase: SQL Editor > New query > cole este arquivo > Run.
-- Pode ser executado de novo sem perder dados (usa IF NOT EXISTS / DROP POLICY IF EXISTS).

-- Dados importados: um registro por tipo de arquivo (o conjunto inteiro em JSON).
create table if not exists public.datasets (
  kind text primary key check (kind in ('ecidade', 'planilha', 'salarial')),
  file_name text not null,
  imported_at timestamptz not null,
  schema_version integer not null default 1,
  records jsonb not null default '[]'::jsonb,
  counts_by_sheet jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Limite de tamanho do conjunto importado (revisão de segurança A4): evita gravar JSON gigante e estourar a cota.
-- "not valid" não reprocessa as linhas já gravadas; vale para toda nova gravação.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'datasets_records_tamanho' and conrelid = 'public.datasets'::regclass
  ) then
    alter table public.datasets
      add constraint datasets_records_tamanho check (pg_catalog.pg_column_size(records) < 20000000) not valid;
  end if;
end $$;

-- Configurações informadas na tela (linha única, id = 1).
create table if not exists public.configuracoes (
  id integer primary key default 1 check (id = 1),
  teto_folha_centavos bigint check (teto_folha_centavos is null or teto_folha_centavos >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists datasets_touch on public.datasets;
create trigger datasets_touch before insert or update on public.datasets
  for each row execute function public.touch_updated();
drop trigger if exists configuracoes_touch on public.configuracoes;
create trigger configuracoes_touch before insert or update on public.configuracoes
  for each row execute function public.touch_updated();

-- Segurança: RLS ligado. As regras finais (só usuários APROVADOS) ficam no fim do arquivo.
-- A chave "anon" é pública (vai no site), por isso visitantes sem login não podem ler nada.
alter table public.datasets enable row level security;
alter table public.configuracoes enable row level security;
revoke all on public.datasets, public.configuracoes from anon;
grant select, insert, update, delete on public.datasets, public.configuracoes to authenticated;

-- (As políticas ficam no fim do arquivo, junto com o controle de aprovação.)

-- =====================================================================
-- Acesso por solicitação e aprovação (2026-11-16)
-- Qualquer pessoa pode se cadastrar pela tela "Solicitar acesso", mas a conta nasce PENDENTE
-- e não vê nenhum dado até um administrador aprovar. Administradores gerenciam a tela "Usuários".
-- =====================================================================

create table if not exists public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  nome text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'bloqueado')),
  papel text not null default 'usuario' check (papel in ('admin', 'usuario')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

-- Funções usadas pelas regras (security definer para consultar perfis sem cair em recursão de RLS).
create or replace function public.is_aprovado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfis where user_id = (select auth.uid()) and status = 'aprovado');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis where user_id = (select auth.uid()) and status = 'aprovado' and papel = 'admin'
  );
$$;

revoke all on function public.is_aprovado() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_aprovado() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Convites (2026-11-17, revisão de segurança A3): o administrador convida pela tela "Usuários"; a Edge Function
-- "convidar-usuario" confere se ele é administrador, pede ao Supabase Auth o envio do convite (inviteUserByEmail) e
-- registra aqui o perfil escolhido. A pessoa define a própria senha pelo link do e-mail.
-- O convite só aprova contas CRIADAS PELO CONVITE (auth.users.invited_at preenchido) e depois que o link foi aberto.
-- Um cadastro público com um e-mail convidado fica pendente como qualquer outro.
create table if not exists public.convites (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  papel text not null default 'usuario' check (papel in ('admin', 'usuario')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  usado_por uuid
);

-- Funções internas ficam no schema "private" (fora da API do Supabase; ninguém as chama pela chave pública).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Aplica o convite de uma conta criada por convite e já confirmada: aprova o perfil ainda pendente com o papel do
-- convite e marca o convite como usado. Idempotente; nunca altera perfis aprovados ou bloqueados.
create or replace function private.aplicar_convite(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_papel text;
begin
  -- Senha vazia = conta criada pelo convite (inviteUserByEmail não define senha; a pessoa só a cria depois de abrir
  -- o link). Se alguém se cadastrou antes com esse e-mail, o Auth reaproveita a conta não confirmada ao convidar
  -- (preenche invited_at), mas ela já tem a senha escolhida por quem se cadastrou: nesse caso fica pendente (A3).
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.invited_at is not null and u.email_confirmed_at is not null
      and coalesce(u.encrypted_password, '') = ''
  ) then
    return;
  end if;

  select c.papel into v_papel from public.convites c
  where c.email = v_email and c.usado_em is null
  for update;
  if v_papel is null then
    return;
  end if;

  update public.perfis set status = 'aprovado', papel = v_papel
  where user_id = p_user_id and status = 'pendente';
  if not found then
    return;
  end if;

  update public.convites set usado_em = pg_catalog.now(), usado_por = p_user_id where email = v_email;
end $$;

revoke all on function private.aplicar_convite(uuid, text) from public, anon, authenticated;

-- Todo novo usuário do Supabase Auth nasce PENDENTE, inclusive o convidado (ele ainda não abriu o link).
-- Usuário criado no painel ou pelo cadastro público fica pendente: o administrador aprova na tela de usuários.
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (user_id, email, nome, status, papel)
  values (
    new.id,
    coalesce(new.email, ''),
    pg_catalog.left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 120),
    'pendente',
    'usuario'
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function public.aplicar_convite_ao_confirmar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.aplicar_convite(new.id, new.email);
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Ao abrir o link do convite o Supabase confirma o e-mail; só então o convite é aplicado, e só para contas
-- criadas por convite (invited_at). Quem se cadastrou sozinho continua pendente mesmo com e-mail convidado.
drop trigger if exists ao_confirmar_email on auth.users;
create trigger ao_confirmar_email after update of email_confirmed_at on auth.users
  for each row when (
    old.email_confirmed_at is null and new.email_confirmed_at is not null and new.invited_at is not null
  )
  execute function public.aplicar_convite_ao_confirmar();

-- Usuários que já existiam (criados no painel) ficam aprovados; se ainda não há administrador,
-- o usuário mais antigo vira administrador. Rodar de novo não altera quem já tem perfil.
insert into public.perfis (user_id, email, nome, status)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'nome', ''), 'aprovado'
from auth.users u
on conflict (user_id) do nothing;

update public.perfis set papel = 'admin'
where user_id = (
  select p.user_id from public.perfis p join auth.users u on u.id = p.user_id
  where p.status = 'aprovado' order by u.created_at asc limit 1
)
and not exists (select 1 from public.perfis where papel = 'admin');

-- Só administradores alteram perfis, nunca o próprio (evita se bloquear ou perder o papel por engano).
-- Quem altera e quando são gravados automaticamente.
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio acesso.';
  end if;
  new.user_id := old.user_id;
  new.email := old.email;
  new.criado_em := old.criado_em;
  new.atualizado_em := pg_catalog.now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

drop trigger if exists perfis_proteger on public.perfis;
create trigger perfis_proteger before update on public.perfis
  for each row execute function public.proteger_perfil();

alter table public.perfis enable row level security;
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (status, papel) on public.perfis to authenticated;

drop policy if exists "ver o próprio perfil ou todos se admin" on public.perfis;
create policy "ver o próprio perfil ou todos se admin" on public.perfis
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admin altera perfis" on public.perfis;
create policy "admin altera perfis" on public.perfis
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Dados importados e configurações: usuários APROVADOS leem; só ADMINISTRADORES importam, alteram ou apagam
-- (revisão de segurança A2: uma conta comum comprometida não consegue adulterar nem apagar os dados).
drop policy if exists "autenticados leem datasets" on public.datasets;
drop policy if exists "autenticados gravam datasets" on public.datasets;
drop policy if exists "aprovados leem datasets" on public.datasets;
drop policy if exists "aprovados gravam datasets" on public.datasets;
drop policy if exists "admin insere datasets" on public.datasets;
drop policy if exists "admin altera datasets" on public.datasets;
drop policy if exists "admin apaga datasets" on public.datasets;
create policy "aprovados leem datasets" on public.datasets
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere datasets" on public.datasets
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin altera datasets" on public.datasets
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga datasets" on public.datasets
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "autenticados leem configuracoes" on public.configuracoes;
drop policy if exists "autenticados gravam configuracoes" on public.configuracoes;
drop policy if exists "aprovados leem configuracoes" on public.configuracoes;
drop policy if exists "aprovados gravam configuracoes" on public.configuracoes;
drop policy if exists "admin insere configuracoes" on public.configuracoes;
drop policy if exists "admin altera configuracoes" on public.configuracoes;
drop policy if exists "admin apaga configuracoes" on public.configuracoes;
create policy "aprovados leem configuracoes" on public.configuracoes
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere configuracoes" on public.configuracoes
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin altera configuracoes" on public.configuracoes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga configuracoes" on public.configuracoes
  for delete to authenticated using ((select public.is_admin()));

-- Convites: administradores veem e cancelam. Criar convite só pela Edge Function "convidar-usuario"
-- (ela usa a chave secreta do servidor, depois de conferir que quem chama é administrador).
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;
grant select, delete on public.convites to authenticated;

drop policy if exists "admin gerencia convites" on public.convites;
drop policy if exists "admin vê convites" on public.convites;
drop policy if exists "admin cancela convites" on public.convites;
create policy "admin vê convites" on public.convites
  for select to authenticated using ((select public.is_admin()));
create policy "admin cancela convites" on public.convites
  for delete to authenticated using ((select public.is_admin()));

-- =====================================================================
-- Indicações só para administradores (revisão de segurança 2026-11-17)
-- "Indicação" (quem indicou a pessoa ao cargo) é dado pessoal de alto risco (pode revelar vínculo político).
-- Ela NÃO fica mais em datasets.records (que todo usuário aprovado lê): vai para esta tabela, legível e
-- gravável só por administradores. Registros na mesma ordem de datasets.records (kind = 'planilha').
-- =====================================================================
create table if not exists public.indicacoes (
  id integer primary key default 1 check (id = 1),
  records jsonb not null default '[]'::jsonb check (pg_catalog.pg_column_size(records) < 5000000),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

drop trigger if exists indicacoes_touch on public.indicacoes;
create trigger indicacoes_touch before insert or update on public.indicacoes
  for each row execute function public.touch_updated();

alter table public.indicacoes enable row level security;
revoke all on public.indicacoes from anon, authenticated;
grant select, insert, update, delete on public.indicacoes to authenticated;

drop policy if exists "admin lê indicacoes" on public.indicacoes;
drop policy if exists "admin insere indicacoes" on public.indicacoes;
drop policy if exists "admin altera indicacoes" on public.indicacoes;
drop policy if exists "admin apaga indicacoes" on public.indicacoes;
create policy "admin lê indicacoes" on public.indicacoes
  for select to authenticated using ((select public.is_admin()));
create policy "admin insere indicacoes" on public.indicacoes
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin altera indicacoes" on public.indicacoes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga indicacoes" on public.indicacoes
  for delete to authenticated using ((select public.is_admin()));

-- Migração dos dados já importados: copia as indicações para public.indicacoes e as REMOVE de datasets.records.
-- Só age se ainda houver a chave "indicacao" em datasets (rodar de novo não faz nada). Cópia e remoção na mesma
-- transação: ou as duas acontecem, ou nenhuma.
do $$
begin
  if exists (
    select 1 from public.datasets d, pg_catalog.jsonb_array_elements(d.records) as e(item)
    where d.kind = 'planilha' and e.item ? 'indicacao'
  ) then
    insert into public.indicacoes (id, records)
    select 1, coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'matricula', coalesce(x.item ->> 'matricula', ''),
        'origem', coalesce(x.item ->> 'origem', ''),
        'indicacao', coalesce(x.item ->> 'indicacao', '')
      ) order by x.ord), '[]'::jsonb)
    from public.datasets d, pg_catalog.jsonb_array_elements(d.records) with ordinality as x(item, ord)
    where d.kind = 'planilha'
    on conflict (id) do update set records = excluded.records;

    update public.datasets d set records = (
      select coalesce(pg_catalog.jsonb_agg(x.item - 'indicacao' order by x.ord), '[]'::jsonb)
      from pg_catalog.jsonb_array_elements(d.records) with ordinality as x(item, ord)
    )
    where d.kind = 'planilha';
  end if;
end $$;
