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

-- Configurações informadas na tela (linha única, id = 1).
create table if not exists public.configuracoes (
  id integer primary key default 1 check (id = 1),
  teto_folha_centavos bigint check (teto_folha_centavos is null or teto_folha_centavos >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
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
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and status = 'aprovado');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and status = 'aprovado' and papel = 'admin');
$$;

revoke all on function public.is_aprovado() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_aprovado() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Convites (2026-11-16): pré-aprovação feita por um administrador. Quem se cadastrar com um e-mail convidado
-- já entra aprovado, com o perfil escolhido no convite. Exige "Confirm email" ligado no Supabase, para que só o
-- dono do e-mail consiga entrar.
create table if not exists public.convites (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  papel text not null default 'usuario' check (papel in ('admin', 'usuario')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  usado_por uuid
);

-- Todo novo usuário do Supabase Auth ganha um perfil: aprovado se havia convite, senão pendente.
create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  convite public.convites%rowtype;
begin
  select * into convite from public.convites
  where email = lower(btrim(coalesce(new.email, ''))) and usado_em is null
  for update;

  insert into public.perfis (user_id, email, nome, status, papel)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 120),
    case when convite.email is not null then 'aprovado' else 'pendente' end,
    coalesce(convite.papel, 'usuario')
  )
  on conflict (user_id) do nothing;

  if convite.email is not null then
    update public.convites set usado_em = now(), usado_por = new.id where email = convite.email;
  end if;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

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
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() then
    raise exception 'Você não pode alterar o próprio acesso.';
  end if;
  new.user_id := old.user_id;
  new.email := old.email;
  new.criado_em := old.criado_em;
  new.atualizado_em := now();
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
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin altera perfis" on public.perfis;
create policy "admin altera perfis" on public.perfis
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dados importados e configurações: agora exigem usuário APROVADO (antes bastava o login).
drop policy if exists "autenticados leem datasets" on public.datasets;
drop policy if exists "autenticados gravam datasets" on public.datasets;
drop policy if exists "aprovados leem datasets" on public.datasets;
drop policy if exists "aprovados gravam datasets" on public.datasets;
create policy "aprovados leem datasets" on public.datasets
  for select to authenticated using (public.is_aprovado());
create policy "aprovados gravam datasets" on public.datasets
  for all to authenticated using (public.is_aprovado()) with check (public.is_aprovado());

drop policy if exists "autenticados leem configuracoes" on public.configuracoes;
drop policy if exists "autenticados gravam configuracoes" on public.configuracoes;
drop policy if exists "aprovados leem configuracoes" on public.configuracoes;
drop policy if exists "aprovados gravam configuracoes" on public.configuracoes;
create policy "aprovados leem configuracoes" on public.configuracoes
  for select to authenticated using (public.is_aprovado());
create policy "aprovados gravam configuracoes" on public.configuracoes
  for all to authenticated using (public.is_aprovado()) with check (public.is_aprovado());

-- Convites: só administradores veem, criam e cancelam.
alter table public.convites enable row level security;
revoke all on public.convites from anon, authenticated;
grant select, insert, delete on public.convites to authenticated;

drop policy if exists "admin gerencia convites" on public.convites;
create policy "admin gerencia convites" on public.convites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
