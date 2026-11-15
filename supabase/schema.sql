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

-- Segurança: RLS ligado e acesso só para usuários autenticados.
-- A chave "anon" é pública (vai no site), por isso visitantes sem login não podem ler nada.
alter table public.datasets enable row level security;
alter table public.configuracoes enable row level security;
revoke all on public.datasets, public.configuracoes from anon;
grant select, insert, update, delete on public.datasets, public.configuracoes to authenticated;

drop policy if exists "autenticados leem datasets" on public.datasets;
drop policy if exists "autenticados gravam datasets" on public.datasets;
create policy "autenticados leem datasets" on public.datasets
  for select to authenticated using (true);
create policy "autenticados gravam datasets" on public.datasets
  for all to authenticated using (true) with check (true);

drop policy if exists "autenticados leem configuracoes" on public.configuracoes;
drop policy if exists "autenticados gravam configuracoes" on public.configuracoes;
create policy "autenticados leem configuracoes" on public.configuracoes
  for select to authenticated using (true);
create policy "autenticados gravam configuracoes" on public.configuracoes
  for all to authenticated using (true) with check (true);
