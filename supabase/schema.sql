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

-- =====================================================================
-- Histórico por competência e ajuste de remuneração (2026-11-18, fatias 3 e 4 da aba Funcionários)
-- Desenho em docs/HISTORICO-DADOS.md. Idempotente: pode rodar de novo sem perder dados.
-- Depende de public.datasets, public.perfis, public.touch_updated(), public.is_aprovado() e public.is_admin().
-- =====================================================================

-- Uma linha por competência (mês/ano) importada do Cadastro funcional: de qual arquivo veio e quando.
-- competencia = primeiro dia do mês (2026-11-01 representa 11/2026).
create table if not exists public.historico_competencias (
  competencia date primary key
    check (extract(day from competencia) = 1 and competencia >= date '2000-01-01'),
  arquivo text not null check (pg_catalog.length(arquivo) between 1 and 255),
  importado_em timestamptz not null,
  total integer not null default 0 check (total >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

-- Retrato de cada pessoa em cada competência. Minimização (LGPD): sem remuneração, alimentação, indicação ou CPF.
-- chave_identidade: 'm:<matrícula>' (comissionado) ou 'n:<nome normalizado>|<empresa normalizada>' (terceirizado
-- ou quem não tem matrícula); homônimos na mesma competência recebem sufixo '#2', '#3'... e possivel_duplicidade.
create table if not exists public.historico_retratos (
  id bigint generated always as identity primary key,
  competencia date not null references public.historico_competencias (competencia) on delete cascade,
  chave_identidade text not null
    check (chave_identidade ~ '^(m|n):.+' and pg_catalog.length(chave_identidade) <= 420),
  origem text not null check (origem in ('Comissionado', 'Terceirizado')),
  matricula text not null default '' check (pg_catalog.length(matricula) <= 40),
  nome text not null check (pg_catalog.length(nome) between 1 and 200),
  empresa_secretaria text not null default '' check (pg_catalog.length(empresa_secretaria) <= 200),
  funcao text not null default '' check (pg_catalog.length(funcao) <= 200),
  lotacao text not null default '' check (pg_catalog.length(lotacao) <= 200),
  possivel_duplicidade boolean not null default false,
  created_at timestamptz not null default now(),
  constraint historico_retratos_pessoa_competencia unique (competencia, chave_identidade)
);

-- O índice único (competencia, chave_identidade) cobre a FK e a leitura por competência;
-- este cobre o painel "Histórico do Funcionário" (uma pessoa, competências em ordem).
create index if not exists historico_retratos_pessoa_idx
  on public.historico_retratos (chave_identidade, competencia desc);

drop trigger if exists historico_competencias_touch on public.historico_competencias;
create trigger historico_competencias_touch before insert or update on public.historico_competencias
  for each row execute function public.touch_updated();

alter table public.historico_competencias enable row level security;
alter table public.historico_retratos enable row level security;
revoke all on public.historico_competencias, public.historico_retratos from anon, authenticated;
grant select, insert, update, delete on public.historico_competencias to authenticated;
grant select, insert, delete on public.historico_retratos to authenticated;

-- Mesma regra de datasets: aprovados leem; só administradores gravam ou apagam. Retrato não se edita: substitui-se.
drop policy if exists "aprovados leem historico_competencias" on public.historico_competencias;
drop policy if exists "admin insere historico_competencias" on public.historico_competencias;
drop policy if exists "admin altera historico_competencias" on public.historico_competencias;
drop policy if exists "admin apaga historico_competencias" on public.historico_competencias;
create policy "aprovados leem historico_competencias" on public.historico_competencias
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere historico_competencias" on public.historico_competencias
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin altera historico_competencias" on public.historico_competencias
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin apaga historico_competencias" on public.historico_competencias
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "aprovados leem historico_retratos" on public.historico_retratos;
drop policy if exists "admin insere historico_retratos" on public.historico_retratos;
drop policy if exists "admin apaga historico_retratos" on public.historico_retratos;
create policy "aprovados leem historico_retratos" on public.historico_retratos
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere historico_retratos" on public.historico_retratos
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin apaga historico_retratos" on public.historico_retratos
  for delete to authenticated using ((select public.is_admin()));

-- Substitui, numa única transação, o retrato de uma competência (reimportar a mesma competência é idempotente).
-- security invoker: roda com as permissões de quem chama, então a RLS acima continua valendo; a checagem de
-- administrador aqui só antecipa uma mensagem clara. p_retratos: array JSON com as chaves em snake_case.
create or replace function public.substituir_historico_competencia(
  p_competencia date,
  p_arquivo text,
  p_importado_em timestamptz,
  p_retratos jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem gravar o histórico.' using errcode = '42501';
  end if;
  if pg_catalog.pg_column_size(p_retratos) > 15000000 then
    raise exception 'Arquivo grande demais para o histórico.' using errcode = '22023';
  end if;
  if p_competencia is null or extract(day from p_competencia) <> 1 then
    raise exception 'Informe a competência (mês/ano) deste cadastro.' using errcode = '22023';
  end if;
  if p_competencia > (pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Sao_Paulo'))::date then
    raise exception 'A competência não pode ser posterior ao mês atual.' using errcode = '22023';
  end if;
  if p_retratos is null or pg_catalog.jsonb_typeof(p_retratos) <> 'array' then
    raise exception 'Lista de registros inválida.' using errcode = '22023';
  end if;
  v_total := pg_catalog.jsonb_array_length(p_retratos);
  if v_total > 50000 then
    raise exception 'Arquivo grande demais para o histórico.' using errcode = '22023';
  end if;

  insert into public.historico_competencias (competencia, arquivo, importado_em, total)
  values (p_competencia, p_arquivo, least(coalesce(p_importado_em, pg_catalog.now()), pg_catalog.now()), v_total)
  on conflict (competencia) do update
    set arquivo = excluded.arquivo, importado_em = excluded.importado_em, total = excluded.total;

  delete from public.historico_retratos where competencia = p_competencia;

  insert into public.historico_retratos
    (competencia, chave_identidade, origem, matricula, nome, empresa_secretaria, funcao, lotacao, possivel_duplicidade)
  select p_competencia, r.chave_identidade, r.origem, coalesce(r.matricula, ''), r.nome,
         coalesce(r.empresa_secretaria, ''), coalesce(r.funcao, ''), coalesce(r.lotacao, ''),
         coalesce(r.possivel_duplicidade, false)
  from pg_catalog.jsonb_to_recordset(p_retratos) as r(
    chave_identidade text, origem text, matricula text, nome text,
    empresa_secretaria text, funcao text, lotacao text, possivel_duplicidade boolean
  );

  return v_total;
end $$;

revoke all on function public.substituir_historico_competencia(date, text, timestamptz, jsonb) from public, anon;
grant execute on function public.substituir_historico_competencia(date, text, timestamptz, jsonb) to authenticated;

-- Ajuste de remuneração feito no sistema (R7). Registro de auditoria só de inclusão: cada alteração é uma linha nova;
-- o valor vigente é a linha mais recente de (importado_em, posicao). Vale só para a importação do Cadastro funcional
-- identificada por importado_em (= datasets.imported_at de kind 'planilha'): reimportar troca o imported_at e os
-- ajustes antigos deixam de valer (ficam como auditoria até "Limpar dados importados").
-- posicao = índice do registro em datasets.records (mesma convenção de public.indicacoes).
create table if not exists public.ajustes_remuneracao (
  id bigint generated always as identity primary key,
  importado_em timestamptz not null,
  posicao integer not null check (posicao >= 0),
  origem text not null check (origem in ('Comissionado', 'Terceirizado')),
  linha integer not null check (linha > 0),
  nome text not null default '' check (pg_catalog.length(nome) <= 200),
  valor_centavos bigint not null check (valor_centavos between 1 and 100000000),
  valor_anterior_centavos bigint check (valor_anterior_centavos is null or valor_anterior_centavos >= 0),
  alterado_por uuid default auth.uid() references auth.users (id) on delete set null,
  alterado_por_nome text not null default '' check (pg_catalog.length(alterado_por_nome) <= 200),
  alterado_em timestamptz not null default now()
);

create index if not exists ajustes_remuneracao_registro_idx
  on public.ajustes_remuneracao (importado_em, posicao, id desc);
create index if not exists ajustes_remuneracao_alterado_por_idx
  on public.ajustes_remuneracao (alterado_por);

-- Antes de gravar: confere que o registro existe na importação atual e preenche, sem confiar no navegador,
-- o nome do servidor, o valor anterior, quem alterou e quando.
create or replace function public.preparar_ajuste_remuneracao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_anterior bigint;
begin
  if not public.is_admin() then
    raise exception 'Só administradores podem alterar valores.' using errcode = '42501';
  end if;
  select d.records -> new.posicao into v_item
  from public.datasets d
  where d.kind = 'planilha' and d.imported_at = new.importado_em;
  if v_item is null then
    raise exception 'O cadastro funcional foi reimportado. Atualize a tela e tente de novo.' using errcode = '22023';
  end if;
  if (v_item ->> 'origem') is distinct from new.origem
     or (v_item ->> 'linha') is distinct from new.linha::text then
    raise exception 'Registro não encontrado no cadastro funcional atual.' using errcode = '22023';
  end if;

  select a.valor_centavos into v_anterior
  from public.ajustes_remuneracao a
  where a.importado_em = new.importado_em and a.posicao = new.posicao
  order by a.id desc
  limit 1;
  if not found then
    v_anterior := case
      when pg_catalog.jsonb_typeof(v_item -> 'remuneracao') = 'number'
        then pg_catalog.round((v_item ->> 'remuneracao')::numeric * 100)::bigint
    end;
  end if;

  new.nome := pg_catalog.left(coalesce(v_item ->> 'servidor', ''), 200);
  new.valor_anterior_centavos := v_anterior;
  new.alterado_por := auth.uid();
  new.alterado_em := pg_catalog.now();
  new.alterado_por_nome := coalesce((
    select pg_catalog.left(coalesce(nullif(p.nome, ''), p.email), 200)
    from public.perfis p where p.user_id = auth.uid()
  ), '');
  return new;
end $$;

drop trigger if exists ajustes_remuneracao_preparar on public.ajustes_remuneracao;
create trigger ajustes_remuneracao_preparar before insert on public.ajustes_remuneracao
  for each row execute function public.preparar_ajuste_remuneracao();

alter table public.ajustes_remuneracao enable row level security;
revoke all on public.ajustes_remuneracao from anon, authenticated;
grant select, insert, delete on public.ajustes_remuneracao to authenticated;

-- Aprovados veem o selo "Ajustado no sistema"; só administradores incluem; ninguém edita (auditoria);
-- administradores apagam apenas ao limpar os dados importados.
drop policy if exists "aprovados leem ajustes_remuneracao" on public.ajustes_remuneracao;
drop policy if exists "admin insere ajustes_remuneracao" on public.ajustes_remuneracao;
drop policy if exists "admin apaga ajustes_remuneracao" on public.ajustes_remuneracao;
create policy "aprovados leem ajustes_remuneracao" on public.ajustes_remuneracao
  for select to authenticated using ((select public.is_aprovado()));
create policy "admin insere ajustes_remuneracao" on public.ajustes_remuneracao
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin apaga ajustes_remuneracao" on public.ajustes_remuneracao
  for delete to authenticated using ((select public.is_admin()));
